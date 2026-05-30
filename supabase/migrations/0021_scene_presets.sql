-- =====================================================================
-- 0021 — Bibliothèque de setups de scène par marque (Storyboard Lot 2)
--
-- Feedback testeurs : remplir 4 champs par scène à chaque vidéo = trop
-- long. Beaucoup de créateurs filment toujours aux mêmes endroits / avec
-- les mêmes cadrages ("mes 6 coins de bureau"). On leur permet de définir
-- des SETUPS réutilisables, puis de les insérer en 1 clic dans le
-- storyboard (il ne reste qu'à taper le dialogue).
--
-- Un preset = un setup flexible : label obligatoire, le reste optionnel
-- (photo de référence, cadrage par défaut, notes de montage par défaut).
-- Scoped par marque, exactement comme brand_pillars / brand_objectives.
--
-- La biblio se remplit des 2 côtés :
--   - en avance (le pro définit ses setups)
--   - au vol ("enregistrer cette scène comme setup" depuis le storyboard)
--
-- Idempotent.
-- =====================================================================

create table if not exists public.brand_scene_presets (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references public.brands(id) on delete cascade,
  label                 text not null check (length(trim(label)) > 0),
  reference_image_url   text,
  default_camera        text,
  default_editing_notes text,
  position              int not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists brand_scene_presets_brand_idx
  on public.brand_scene_presets(brand_id, position);

-- ============================ RLS ============================
alter table public.brand_scene_presets enable row level security;

drop policy if exists "scene_presets_select" on public.brand_scene_presets;
create policy "scene_presets_select" on public.brand_scene_presets
  for select to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "scene_presets_insert" on public.brand_scene_presets;
create policy "scene_presets_insert" on public.brand_scene_presets
  for insert to authenticated
  with check (public.is_brand_member(brand_id));

drop policy if exists "scene_presets_update" on public.brand_scene_presets;
create policy "scene_presets_update" on public.brand_scene_presets
  for update to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "scene_presets_delete" on public.brand_scene_presets;
create policy "scene_presets_delete" on public.brand_scene_presets
  for delete to authenticated
  using (public.is_brand_member(brand_id));
