-- =====================================================================
-- 0101 — Les parties d'un contenu long
-- Idempotent.
--
-- Une seule table pour les quatre formats : chapitres d'une vidéo longue,
-- déroulé d'un direct, questions d'un podcast, intertitres d'un article.
--   kind = 'section'    : une partie (titre + texte + minutes prévues)
--   kind = 'guest'      : l'invité (titre = nom, texte = présentation)
--   kind = 'transcript' : la transcription collée après l'enregistrement —
--                         matière de travail, JAMAIS lisible par le client.
-- =====================================================================

create table if not exists public.content_sections (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid not null references public.contents(id) on delete cascade,
  kind        text not null default 'section'
              check (kind in ('section', 'guest', 'transcript')),
  position    integer not null default 0,
  title       text check (char_length(title) <= 300),
  body        text check (char_length(body) <= 150000),
  minutes     smallint check (minutes between 0 and 600),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists content_sections_content_idx
  on public.content_sections (content_id, kind, position);

-- Un seul invité et une seule transcription par contenu.
create unique index if not exists content_sections_single_idx
  on public.content_sections (content_id, kind)
  where kind <> 'section';

drop trigger if exists content_sections_set_updated_at on public.content_sections;
create trigger content_sections_set_updated_at
  before update on public.content_sections
  for each row execute function public._touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS — écriture réservée à l'équipe (verrou 0052), et la transcription
-- invisible au client : `is_brand_member` inclut le rôle `viewer`.
-- ---------------------------------------------------------------------
alter table public.content_sections enable row level security;

drop policy if exists "content_sections_select" on public.content_sections;
create policy "content_sections_select" on public.content_sections
  for select to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = content_sections.content_id
      and public.is_brand_member(c.brand_id)
      and (content_sections.kind <> 'transcript' or public.is_brand_writer(c.brand_id))
  ));

drop policy if exists "content_sections_insert" on public.content_sections;
create policy "content_sections_insert" on public.content_sections
  for insert to authenticated
  with check (exists (
    select 1 from public.contents c
    where c.id = content_sections.content_id and public.is_brand_writer(c.brand_id)
  ));

drop policy if exists "content_sections_update" on public.content_sections;
create policy "content_sections_update" on public.content_sections
  for update to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = content_sections.content_id and public.is_brand_writer(c.brand_id)
  ))
  with check (exists (
    select 1 from public.contents c
    where c.id = content_sections.content_id and public.is_brand_writer(c.brand_id)
  ));

drop policy if exists "content_sections_delete" on public.content_sections;
create policy "content_sections_delete" on public.content_sections
  for delete to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = content_sections.content_id and public.is_brand_writer(c.brand_id)
  ));

revoke all on public.content_sections from anon;
grant select, insert, update, delete on public.content_sections to authenticated;

-- ---------------------------------------------------------------------
-- Enregistrer d'un coup, tout ou rien — et seulement ce qui a changé : deux
-- personnes sur le même contenu n'écrasent que la partie qu'elles ont toutes
-- les deux touchée. `p_order` range, `p_deleted` retire ; une partie qu'une
-- collègue vient d'ajouter n'est dans aucun des deux, donc reste.
-- `security invoker` : la RLS s'applique.
-- ---------------------------------------------------------------------
create or replace function public.save_content_sections(
  p_content_id uuid,
  p_sections   jsonb,
  p_order      uuid[],
  p_deleted    uuid[] default '{}'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.contents c
    where c.id = p_content_id and public.is_brand_writer(c.brand_id)
  ) then
    raise exception 'not_authorized';
  end if;

  if jsonb_typeof(p_sections) <> 'array'
     or jsonb_array_length(p_sections) > 60
     or coalesce(cardinality(p_order), 0) > 60 then
    raise exception 'too_many_sections';
  end if;

  delete from public.content_sections
  where content_id = p_content_id
    and kind = 'section'
    and id = any(coalesce(p_deleted, '{}'));

  insert into public.content_sections
    (id, content_id, kind, position, title, body, minutes)
  select
    (s.value ->> 'id')::uuid,
    p_content_id,
    'section',
    coalesce(array_position(p_order, (s.value ->> 'id')::uuid) - 1, 0),
    nullif(trim(s.value ->> 'title'), ''),
    nullif(s.value ->> 'body', ''),
    (s.value ->> 'minutes')::smallint
  from jsonb_array_elements(p_sections) as s(value)
  on conflict (id) do update
    set title    = excluded.title,
        body     = excluded.body,
        minutes  = excluded.minutes
    where content_sections.content_id = excluded.content_id
      and content_sections.kind = 'section';

  update public.content_sections x
  set position = array_position(p_order, x.id) - 1
  where x.content_id = p_content_id
    and x.kind = 'section'
    and x.id = any(p_order)
    and x.position is distinct from array_position(p_order, x.id) - 1;
end$$;

revoke all on function public.save_content_sections(uuid, jsonb, uuid[], uuid[]) from public;
grant execute on function public.save_content_sections(uuid, jsonb, uuid[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- « Quelqu'un vient de modifier » (0091) : écrire une partie compte.
-- Reprise de 0091, avec `content_sections` en plus.
-- ---------------------------------------------------------------------
create or replace function public.touch_brand_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec  record := coalesce(new, old);
  v_brand uuid;
  v_area  text;
begin
  -- Migrations, cron, service role : pas d'auteur, pas de bandeau.
  if auth.uid() is null then
    return null;
  end if;

  if tg_table_name = 'contents' then
    v_area := 'contents'; v_brand := rec.brand_id;
  elsif tg_table_name in ('content_media', 'content_sections') then
    v_area := 'contents';
    select c.brand_id into v_brand from public.contents c where c.id = rec.content_id;
  elsif tg_table_name = 'ad_campaigns' then
    v_area := 'ads'; v_brand := rec.brand_id;
  elsif tg_table_name = 'ad_sets' then
    v_area := 'ads';
    select ac.brand_id into v_brand from public.ad_campaigns ac where ac.id = rec.campaign_id;
  elsif tg_table_name = 'ads' then
    v_area := 'ads';
    select ac.brand_id into v_brand
      from public.ad_sets s join public.ad_campaigns ac on ac.id = s.campaign_id
     where s.id = rec.ad_set_id;
  elsif tg_table_name = 'tasks' then
    v_area := 'tasks'; v_brand := rec.brand_id;
  end if;

  if v_brand is not null then
    insert into public.brand_changes (brand_id, area, actor_id, changed_at)
    values (v_brand, v_area, auth.uid(), now())
    on conflict (brand_id, area, actor_id) do update set changed_at = excluded.changed_at;
  end if;
  return null;
end$$;

drop trigger if exists trg_brand_change on public.content_sections;
create trigger trg_brand_change
  after insert or update or delete on public.content_sections
  for each row execute function public.touch_brand_change();

select pg_notify('pgrst', 'reload schema');
