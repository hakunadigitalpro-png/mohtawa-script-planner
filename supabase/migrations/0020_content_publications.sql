-- =====================================================================
-- 0020 — Multi-plateformes par vidéo (Idée 10)
--
-- Une vidéo peut maintenant être publiée sur plusieurs plateformes
-- (Instagram, TikTok, YouTube, etc.), chacune avec sa propre date de
-- publication et sa propre URL.
--
-- Modèle : nouvelle table content_publications. Une row par
-- (contenu × plateforme). Une vidéo unique sur 3 plateformes = 3 rows.
--
-- STRATÉGIE DE COMPATIBILITÉ :
-- Les colonnes singulières contents.platform / contents.date /
-- contents.video_url restent et sont AUTO-SYNCHRONISÉES via trigger
-- sur la publication "primaire" (la plus ancienne par scheduled_date,
-- puis created_at en tie-breaker). Tous les readers legacy (Calendrier,
-- Performance, Share view, Print, Dashboard filters) continuent de
-- marcher sans refactor immédiat.
--
-- Idempotent.
-- =====================================================================

-- 1) Table -----------------------------------------------------------
create table if not exists public.content_publications (
  id              uuid primary key default gen_random_uuid(),
  content_id      uuid not null references public.contents(id) on delete cascade,
  platform        text not null,
  scheduled_date  date,
  url             text,
  created_at      timestamptz not null default now(),
  -- Une vidéo ne se publie pas 2 fois sur la même plateforme.
  unique (content_id, platform)
);

create index if not exists content_publications_content_idx
  on public.content_publications(content_id);

create index if not exists content_publications_date_idx
  on public.content_publications(scheduled_date)
  where scheduled_date is not null;

-- 2) RLS -------------------------------------------------------------
alter table public.content_publications enable row level security;

drop policy if exists "publications_select_members" on public.content_publications;
create policy "publications_select_members" on public.content_publications
  for select to authenticated
  using (
    exists (
      select 1 from public.contents c
      where c.id = content_publications.content_id
        and public.is_brand_member(c.brand_id)
    )
  );

drop policy if exists "publications_insert_members" on public.content_publications;
create policy "publications_insert_members" on public.content_publications
  for insert to authenticated
  with check (
    exists (
      select 1 from public.contents c
      where c.id = content_publications.content_id
        and public.is_brand_member(c.brand_id)
    )
  );

drop policy if exists "publications_update_members" on public.content_publications;
create policy "publications_update_members" on public.content_publications
  for update to authenticated
  using (
    exists (
      select 1 from public.contents c
      where c.id = content_publications.content_id
        and public.is_brand_member(c.brand_id)
    )
  );

drop policy if exists "publications_delete_members" on public.content_publications;
create policy "publications_delete_members" on public.content_publications
  for delete to authenticated
  using (
    exists (
      select 1 from public.contents c
      where c.id = content_publications.content_id
        and public.is_brand_member(c.brand_id)
    )
  );

-- 3) Backfill : pour chaque vidéo qui a déjà une plateforme, créer la
-- publication correspondante si elle n'existe pas encore.
insert into public.content_publications (content_id, platform, scheduled_date, url)
select c.id, c.platform, c.date, c.video_url
from public.contents c
where c.platform is not null
  and c.platform <> ''
  and not exists (
    select 1 from public.content_publications p
    where p.content_id = c.id and p.platform = c.platform
  );

-- 4) Trigger de synchronisation legacy ------------------------------
-- À chaque modif des publications d'un contenu, on remet à jour ses
-- colonnes singulières contents.platform / date / video_url avec la
-- publication "primaire" (la plus ancienne par date, puis created_at).
create or replace function public.sync_legacy_publication_fields(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub record;
begin
  select platform, scheduled_date, url into v_pub
  from public.content_publications
  where content_id = p_content_id
  order by scheduled_date nulls last, created_at asc
  limit 1;

  if found then
    update public.contents
    set platform  = v_pub.platform,
        date      = v_pub.scheduled_date,
        video_url = v_pub.url
    where id = p_content_id;
  else
    -- Plus aucune publication → on clear les colonnes legacy
    update public.contents
    set platform  = null,
        date      = null,
        video_url = null
    where id = p_content_id;
  end if;
end$$;

-- Wrapper trigger (Postgres ne permet pas de passer un arg directement)
create or replace function public.trigger_sync_legacy_publication()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_legacy_publication_fields(old.content_id);
    return old;
  else
    perform public.sync_legacy_publication_fields(new.content_id);
    return new;
  end if;
end$$;

drop trigger if exists publications_sync_legacy on public.content_publications;
create trigger publications_sync_legacy
  after insert or update or delete on public.content_publications
  for each row execute function public.trigger_sync_legacy_publication();
