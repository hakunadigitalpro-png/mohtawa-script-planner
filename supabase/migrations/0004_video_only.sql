-- =====================================================================
-- 0004 — Mohtawa = Reel + Story uniquement.
--        + image_url sur storyboard_scenes
--        + nouvelle table story_slides (remplace story1..story5)
--        + bucket Storage content-media + policies
-- Idempotent.
-- =====================================================================

-- 1) Restreindre les types à 'reel' / 'story' --------------------------
alter table public.contents drop constraint if exists contents_type_check;
alter table public.contents
  add constraint contents_type_check check (type in ('reel','story'));

-- 2) image_url sur storyboard_scenes -----------------------------------
alter table public.storyboard_scenes
  add column if not exists image_url text;

-- 3) story_slides (5 cartes phone-preview) -----------------------------
create table if not exists public.story_slides (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.contents(id) on delete cascade,
  slot_number  int  not null check (slot_number between 1 and 10),
  body         text,
  image_url    text,
  unique (content_id, slot_number)
);

create index if not exists story_slides_content_idx
  on public.story_slides(content_id);

-- Drop legacy story1..story5 columns (db neuve, pas de data à perdre) --
alter table public.story_details drop column if exists story1;
alter table public.story_details drop column if exists story2;
alter table public.story_details drop column if exists story3;
alter table public.story_details drop column if exists story4;
alter table public.story_details drop column if exists story5;

-- RLS pour story_slides (même pattern que les autres) ------------------
alter table public.story_slides enable row level security;

drop policy if exists "story_slides_select" on public.story_slides;
create policy "story_slides_select" on public.story_slides
  for select to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = story_slides.content_id
      and public.is_brand_member(c.brand_id)
  ));

drop policy if exists "story_slides_insert" on public.story_slides;
create policy "story_slides_insert" on public.story_slides
  for insert to authenticated
  with check (exists (
    select 1 from public.contents c
    where c.id = story_slides.content_id
      and public.is_brand_member(c.brand_id)
  ));

drop policy if exists "story_slides_update" on public.story_slides;
create policy "story_slides_update" on public.story_slides
  for update to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = story_slides.content_id
      and public.is_brand_member(c.brand_id)
  ));

drop policy if exists "story_slides_delete" on public.story_slides;
create policy "story_slides_delete" on public.story_slides
  for delete to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = story_slides.content_id
      and public.is_brand_member(c.brand_id)
  ));

-- 4) Bucket Storage public content-media -------------------------------
insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do update set public = true;

-- Policies Storage : upload/delete = membres de la brand,
-- chemin = {content_id}/{filename}
drop policy if exists "content_media_insert" on storage.objects;
create policy "content_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_member(c.brand_id)
    )
  );

drop policy if exists "content_media_update" on storage.objects;
create policy "content_media_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_member(c.brand_id)
    )
  );

drop policy if exists "content_media_delete" on storage.objects;
create policy "content_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_member(c.brand_id)
    )
  );

-- SELECT public via la nature publique du bucket (pas besoin de policy).
