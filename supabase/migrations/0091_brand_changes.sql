-- Bandeau « X a modifié un contenu — Mettre à jour » : quand deux
-- personnes travaillent en même temps sur la même marque, celle qui n'a
-- pas fait la modif doit le savoir sans avoir à actualiser au hasard.
--
-- Une ligne par (marque, zone, auteur) avec l'heure de sa dernière modif.
-- Les triggers l'entretiennent ; la page interroge `brand_changes_since`
-- toutes les 20 s et ne garde que les modifs des AUTRES.

create table if not exists public.brand_changes (
  brand_id   uuid not null references public.brands(id) on delete cascade,
  area       text not null check (area in ('contents', 'ads', 'tasks')),
  actor_id   uuid not null,
  changed_at timestamptz not null default now(),
  primary key (brand_id, area, actor_id)
);
-- Aucune policy : on ne lit que par la RPC ci-dessous.
alter table public.brand_changes enable row level security;

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
  elsif tg_table_name = 'content_media' then
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

do $$
declare t text;
begin
  foreach t in array array['contents','content_media','ad_campaigns','ad_sets','ads','tasks'] loop
    execute format('drop trigger if exists trg_brand_change on public.%I', t);
    execute format(
      'create trigger trg_brand_change after insert or update or delete on public.%I
         for each row execute function public.touch_brand_change()', t);
  end loop;
end$$;

-- Dernière modif faite par quelqu'un d'autre que moi, par zone, avec son
-- prénom. Réservé aux membres de la marque.
create or replace function public.brand_changes_since(p_brand uuid)
returns table (area text, changed_at timestamptz, actor_name text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (bc.area)
         bc.area,
         bc.changed_at,
         coalesce(
           nullif(split_part(trim(u.raw_user_meta_data->>'full_name'), ' ', 1), ''),
           split_part(u.email, '@', 1)
         )::text
    from public.brand_changes bc
    left join auth.users u on u.id = bc.actor_id
   where bc.brand_id = p_brand
     and bc.actor_id <> auth.uid()
     and exists (select 1 from public.brand_members bm
                  where bm.brand_id = p_brand and bm.user_id = auth.uid())
   order by bc.area, bc.changed_at desc;
$$;
revoke all on function public.brand_changes_since(uuid) from public;
grant execute on function public.brand_changes_since(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
