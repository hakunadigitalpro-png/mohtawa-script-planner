-- =====================================================================
-- 0031 — Brand Kit : identité de marque personnalisable.
--
-- Logo, palette de couleurs, slogan, audience, voix de marque, hashtags.
-- 1 kit par marque. L'audience + la voix serviront à personnaliser les
-- générations IA (script écrit pour la bonne cible, dans le bon ton).
-- Le logo est stocké sous brand/{brand_id}/… dans le bucket content-media.
-- Idempotent.
-- =====================================================================

create table if not exists public.brand_kits (
  brand_id        uuid primary key references public.brands(id) on delete cascade,
  logo_url        text,
  color_primary   text,
  color_secondary text,
  color_accent    text,
  tagline         text,
  audience        text,
  voice           text,
  hashtags        text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

-- ============================ RLS ============================
alter table public.brand_kits enable row level security;

drop policy if exists "brand_kits_select" on public.brand_kits;
create policy "brand_kits_select" on public.brand_kits
  for select to authenticated using (public.is_brand_member(brand_id));

drop policy if exists "brand_kits_insert" on public.brand_kits;
create policy "brand_kits_insert" on public.brand_kits
  for insert to authenticated with check (public.is_brand_member(brand_id));

drop policy if exists "brand_kits_update" on public.brand_kits;
create policy "brand_kits_update" on public.brand_kits
  for update to authenticated using (public.is_brand_member(brand_id));

drop policy if exists "brand_kits_delete" on public.brand_kits;
create policy "brand_kits_delete" on public.brand_kits
  for delete to authenticated using (public.is_brand_member(brand_id));

-- ============ Storage : logos sous brand/{brand_id}/… ============
drop policy if exists "content_media_brand_insert" on storage.objects;
create policy "content_media_brand_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'brand'
    and public.is_brand_member(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "content_media_brand_delete" on storage.objects;
create policy "content_media_brand_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'brand'
    and public.is_brand_member(((storage.foldername(name))[2])::uuid)
  );
