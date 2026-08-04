-- =====================================================================
-- 0038 — Visuels ordonnés pour les contenus non-vidéo
--
-- Un Post/Infographie a 1 visuel, un Carrousel en a plusieurs, dans l'ordre.
-- On stocke chaque visuel dans content_media (chemin/URL Storage), ordonné
-- par `position`. La légende, elle, vit déjà sur contents.caption.
--
-- RLS calquée sur le reste : accès réservé aux membres de la marque du
-- contenu parent. Idempotent.
-- =====================================================================

create table if not exists public.content_media (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid not null references public.contents(id) on delete cascade,
  position    int  not null default 0,
  image_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists content_media_content_idx
  on public.content_media(content_id, position);

alter table public.content_media enable row level security;

drop policy if exists "content_media_select" on public.content_media;
create policy "content_media_select" on public.content_media
  for select to authenticated
  using (exists (select 1 from public.contents c
                 where c.id = content_media.content_id
                   and public.is_brand_member(c.brand_id)));

drop policy if exists "content_media_insert" on public.content_media;
create policy "content_media_insert" on public.content_media
  for insert to authenticated
  with check (exists (select 1 from public.contents c
                      where c.id = content_media.content_id
                        and public.is_brand_member(c.brand_id)));

drop policy if exists "content_media_update" on public.content_media;
create policy "content_media_update" on public.content_media
  for update to authenticated
  using (exists (select 1 from public.contents c
                 where c.id = content_media.content_id
                   and public.is_brand_member(c.brand_id)));

drop policy if exists "content_media_delete" on public.content_media;
create policy "content_media_delete" on public.content_media
  for delete to authenticated
  using (exists (select 1 from public.contents c
                 where c.id = content_media.content_id
                   and public.is_brand_member(c.brand_id)));
