-- =====================================================================
-- 0104 — Le brief d'un article, la fiche auteur, et « à valider par l'auteur »
-- Idempotent.
--
--   1. `brand_kits.author_sheet` : ce qui ne change pas d'un article à l'autre
--      (qui parle, preuves, ce qu'on ne promet pas, contact). Demandé une fois.
--   2. `article_briefs` : le brief, l'idée d'image, les titres proposés, les
--      versions reçues de Krea et les versions d'avant. Équipe seulement.
--   3. `article_claims` : ce que l'auteur doit vérifier. Le client lit,
--      l'équipe coche. Son « Je valide » couvre la liste.
--   4. `write_article` / `restore_article` : remplacer un article entier, ou
--      revenir à une version d'avant, d'un coup — tout ou rien.
-- =====================================================================

alter table public.brand_kits
  add column if not exists author_sheet jsonb;

-- ---------------------------------------------------------------------
-- Brief — lecture ET écriture réservées à l'équipe
-- ---------------------------------------------------------------------
create table if not exists public.article_briefs (
  content_id  uuid primary key references public.contents(id) on delete cascade,
  brief       jsonb,
  cover_brief text check (char_length(cover_brief) <= 4000),
  /** Les versions reçues de Krea, la plus récente d'abord. */
  drafts      jsonb not null default '[]'::jsonb,
  /** Les articles d'avant, le plus récent d'abord. Le tout premier reste. */
  versions    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

drop trigger if exists article_briefs_set_updated_at on public.article_briefs;
create trigger article_briefs_set_updated_at
  before update on public.article_briefs
  for each row execute function public._touch_updated_at();

alter table public.article_briefs enable row level security;
revoke all on public.article_briefs from anon;
grant select, insert, update, delete on public.article_briefs to authenticated;

drop policy if exists "article_briefs_all" on public.article_briefs;
create policy "article_briefs_all" on public.article_briefs
  for all to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = article_briefs.content_id and public.is_brand_writer(c.brand_id)
  ))
  with check (exists (
    select 1 from public.contents c
    where c.id = article_briefs.content_id and public.is_brand_writer(c.brand_id)
  ));

-- ---------------------------------------------------------------------
-- À valider par l'auteur
-- ---------------------------------------------------------------------
create table if not exists public.article_claims (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid not null references public.contents(id) on delete cascade,
  position    integer not null default 0,
  text        text not null check (char_length(text) between 1 and 600),
  checked_by  uuid references auth.users(id) on delete set null,
  checked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists article_claims_content_idx
  on public.article_claims (content_id, position);

-- Qui a coché et quand : posé par la base. Un texte modifié n'est plus vérifié.
create or replace function public.article_claims_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.text is distinct from old.text then
    new.checked_at := null;
  end if;
  -- Retour à une version d'avant : qui avait vérifié, et quand, revient avec.
  if tg_op = 'INSERT' and current_setting('kreatly.article_restore', true) = '1' then
    return new;
  end if;
  if new.checked_at is null then
    new.checked_by := null;
  elsif tg_op = 'INSERT' or old.checked_at is null then
    new.checked_at := now();
    new.checked_by := auth.uid();
  else
    new.checked_at := old.checked_at;
    -- Compte supprimé (`on delete set null`) : ne pas remettre l'ancien.
    if new.checked_by is not null then
      new.checked_by := old.checked_by;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists article_claims_stamp_trg on public.article_claims;
create trigger article_claims_stamp_trg
  before insert or update on public.article_claims
  for each row execute function public.article_claims_stamp();

alter table public.article_claims enable row level security;
revoke all on public.article_claims from anon;
grant select, insert, update, delete on public.article_claims to authenticated;

drop policy if exists "article_claims_select" on public.article_claims;
create policy "article_claims_select" on public.article_claims
  for select to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = article_claims.content_id and public.is_brand_member(c.brand_id)
  ));

drop policy if exists "article_claims_insert" on public.article_claims;
create policy "article_claims_insert" on public.article_claims
  for insert to authenticated
  with check (exists (
    select 1 from public.contents c
    where c.id = article_claims.content_id and public.is_brand_writer(c.brand_id)
  ));

drop policy if exists "article_claims_update" on public.article_claims;
create policy "article_claims_update" on public.article_claims
  for update to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = article_claims.content_id and public.is_brand_writer(c.brand_id)
  ))
  with check (exists (
    select 1 from public.contents c
    where c.id = article_claims.content_id and public.is_brand_writer(c.brand_id)
  ));

drop policy if exists "article_claims_delete" on public.article_claims;
create policy "article_claims_delete" on public.article_claims
  for delete to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = article_claims.content_id and public.is_brand_writer(c.brand_id)
  ));

-- ---------------------------------------------------------------------
-- Remplacer l'article entier, tout ou rien. `security invoker` : la RLS de
-- chaque table s'applique. La version d'avant est gardée pour revenir.
-- ---------------------------------------------------------------------
create or replace function public.article_snapshot(p_content_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  select jsonb_build_object(
    'title', c.title,
    'subtitle', c.subtitle,
    'caption', c.caption,
    'cover_brief', (select b.cover_brief from public.article_briefs b where b.content_id = c.id),
    'parts', coalesce((
      select jsonb_agg(
        jsonb_build_object('role', s.role, 'title', s.title, 'body', s.body)
        order by s.position
      )
      from public.content_sections s
      where s.content_id = c.id and s.kind = 'section'
    ), '[]'::jsonb),
    'claims', coalesce((
      select jsonb_agg(
        jsonb_build_object('text', a.text, 'checked_at', a.checked_at, 'checked_by', a.checked_by)
        order by a.position
      )
      from public.article_claims a where a.content_id = c.id
    ), '[]'::jsonb)
  )
  from public.contents c where c.id = p_content_id;
$$;

revoke all on function public.article_snapshot(uuid) from public;
grant execute on function public.article_snapshot(uuid) to authenticated;

-- Écrit un article sur la fiche. `p_exact` : tel quel, vides compris (retour en
-- arrière). Sinon ce qui manque à la nouvelle version (réponse coupée) laisse en
-- place ce qui existe : un texte de partage ne s'efface pas par accident.
create or replace function public.write_article(
  p_content_id uuid,
  p_article    jsonb,
  p_exact      boolean
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before   jsonb;
  v_versions jsonb;
begin
  if not exists (
    select 1 from public.contents c
    where c.id = p_content_id
      and c.type = 'article'
      and public.is_brand_writer(c.brand_id)
  ) then
    raise exception 'not_authorized';
  end if;

  if jsonb_typeof(p_article -> 'parts') is distinct from 'array'
     or jsonb_array_length(p_article -> 'parts') > 60
     or (not p_exact and jsonb_array_length(p_article -> 'parts') = 0) then
    raise exception 'invalid_article';
  end if;

  -- Deux remplacements en même temps passent l'un après l'autre.
  perform 1 from public.contents where id = p_content_id for update;
  v_before := public.article_snapshot(p_content_id);

  update public.contents
  set title    = case when p_exact then p_article ->> 'title'
                      else coalesce(nullif(trim(p_article ->> 'title'), ''), title) end,
      subtitle = case when p_exact then p_article ->> 'subtitle'
                      else coalesce(nullif(trim(p_article ->> 'subtitle'), ''), subtitle) end,
      caption  = case when p_exact then p_article ->> 'caption'
                      else coalesce(nullif(trim(p_article ->> 'caption'), ''), caption) end
  where id = p_content_id;

  delete from public.content_sections
  where content_id = p_content_id and kind = 'section';

  insert into public.content_sections (content_id, kind, position, role, title, body)
  select p_content_id, 'section', (x.ordinality - 1)::integer,
         x.value ->> 'role',
         nullif(trim(x.value ->> 'title'), ''),
         nullif(x.value ->> 'body', '')
  from jsonb_array_elements(p_article -> 'parts') with ordinality as x(value, ordinality);

  -- Absente (null) : la liste en place reste. Vide : elle se vide.
  if jsonb_typeof(p_article -> 'claims') = 'array' then
    delete from public.article_claims where content_id = p_content_id;
    if p_exact then
      perform set_config('kreatly.article_restore', '1', true);
    end if;
    insert into public.article_claims (content_id, position, text, checked_at, checked_by)
    select p_content_id, (x.ordinality - 1)::integer, left(trim(x.value ->> 'text'), 600),
           case when p_exact then (x.value ->> 'checked_at')::timestamptz end,
           -- Un compte supprimé depuis ne revient pas.
           case when p_exact then (
             select u.user_id from public.brand_members u
             join public.contents c on c.brand_id = u.brand_id
             where c.id = p_content_id and u.user_id = (x.value ->> 'checked_by')::uuid
           ) end
    from jsonb_array_elements(p_article -> 'claims') with ordinality as x(value, ordinality)
    where coalesce(trim(x.value ->> 'text'), '') <> '';
    perform set_config('kreatly.article_restore', '', true);
  end if;

  insert into public.article_briefs (content_id, cover_brief)
  values (p_content_id, nullif(trim(p_article ->> 'cover_brief'), ''))
  on conflict (content_id) do update
    set cover_brief = case when p_exact then excluded.cover_brief
                           else coalesce(excluded.cover_brief, article_briefs.cover_brief) end;

  -- Rien n'a changé (second clic après une réponse perdue) : rien à garder. Sinon
  -- la version d'avant s'ajoute ; au-delà de 8, on retire une version du milieu,
  -- jamais la plus ancienne, qui est l'article d'origine.
  if v_before is distinct from public.article_snapshot(p_content_id)
     and (jsonb_array_length(v_before -> 'parts') > 0 or coalesce(v_before ->> 'caption', '') <> '') then
    select versions into v_versions
    from public.article_briefs where content_id = p_content_id;
    v_versions := jsonb_build_array(v_before || jsonb_build_object('at', now())) || v_versions;
    if jsonb_array_length(v_versions) > 8 then
      v_versions := v_versions - (jsonb_array_length(v_versions) - 2);
    end if;
    update public.article_briefs set versions = v_versions where content_id = p_content_id;
  end if;
end$$;

revoke all on function public.write_article(uuid, jsonb, boolean) from public;
grant execute on function public.write_article(uuid, jsonb, boolean) to authenticated;

-- Revenir à l'une des versions gardées. L'actuelle prend sa place dans la liste.
create or replace function public.restore_article(p_content_id uuid, p_at timestamptz)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version jsonb;
begin
  select v.value into v_version
  from public.article_briefs b, jsonb_array_elements(b.versions) as v(value)
  where b.content_id = p_content_id and (v.value ->> 'at')::timestamptz = p_at
  limit 1;

  if v_version is null then
    raise exception 'nothing_to_restore';
  end if;

  perform public.write_article(p_content_id, v_version - 'at', true);

  update public.article_briefs b
  set versions = coalesce((
    select jsonb_agg(v.value order by v.ordinality)
    from jsonb_array_elements(b.versions) with ordinality as v(value, ordinality)
    where (v.value ->> 'at')::timestamptz <> p_at
  ), '[]'::jsonb)
  where b.content_id = p_content_id;
end$$;

revoke all on function public.restore_article(uuid, timestamptz) from public;
grant execute on function public.restore_article(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- « Quelqu'un vient de modifier » (0091, 0101) : la liste à valider compte.
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
  elsif tg_table_name in ('content_media', 'content_sections', 'article_claims') then
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

drop trigger if exists trg_brand_change on public.article_claims;
create trigger trg_brand_change
  after insert or update or delete on public.article_claims
  for each row execute function public.touch_brand_change();

select pg_notify('pgrst', 'reload schema');
