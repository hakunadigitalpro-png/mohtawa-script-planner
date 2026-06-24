-- =====================================================================
-- 0027 — Mode Vlog : 3e type de contenu.
--
-- Un vlog ne se planifie PAS scène par scène (contrairement au Reel) :
-- on part d'un ANGLE, on capture des MOMENTS pendant la journée, puis on
-- POSE UNE VOIX-OFF par-dessus le montage. D'où une structure dédiée :
--   - vlog_details : angle + hook + arc en 3 temps + voix-off
--   - une CHECKLIST DE CAPTURE = les moments à filmer, cochables sur mobile
--     pendant le tournage. Elle réutilise content_checklist_items avec une
--     nouvelle catégorie 'capture' (pas de nouvelle table : même CRUD, même
--     RLS, même composant de suggestions).
-- Idempotent.
-- =====================================================================

-- 1) Autoriser le type 'vlog' -----------------------------------------
alter table public.contents drop constraint if exists contents_type_check;
alter table public.contents
  add constraint contents_type_check check (type in ('reel', 'story', 'vlog'));

-- 2) Autoriser la catégorie 'capture' sur la checklist ----------------
-- La contrainte CHECK inline de 0011 a le nom auto-généré
-- content_checklist_items_category_check ({table}_{column}_check).
alter table public.content_checklist_items
  drop constraint if exists content_checklist_items_category_check;
alter table public.content_checklist_items
  add constraint content_checklist_items_category_check
  check (category in ('equipment', 'preparation', 'capture'));

-- 3) Détails spécifiques au vlog --------------------------------------
create table if not exists public.vlog_details (
  content_id       uuid primary key references public.contents(id) on delete cascade,
  angle            text,
  hook             text,
  arc_situation    text,
  arc_development  text,
  arc_payoff       text,
  voiceover        text
);

-- ============================ RLS ============================
alter table public.vlog_details enable row level security;

drop policy if exists "vlog_details_select" on public.vlog_details;
create policy "vlog_details_select" on public.vlog_details
  for select to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = vlog_details.content_id
      and public.is_brand_member(c.brand_id)
  ));

drop policy if exists "vlog_details_insert" on public.vlog_details;
create policy "vlog_details_insert" on public.vlog_details
  for insert to authenticated
  with check (exists (
    select 1 from public.contents c
    where c.id = vlog_details.content_id
      and public.is_brand_member(c.brand_id)
  ));

drop policy if exists "vlog_details_update" on public.vlog_details;
create policy "vlog_details_update" on public.vlog_details
  for update to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = vlog_details.content_id
      and public.is_brand_member(c.brand_id)
  ));

drop policy if exists "vlog_details_delete" on public.vlog_details;
create policy "vlog_details_delete" on public.vlog_details
  for delete to authenticated
  using (exists (
    select 1 from public.contents c
    where c.id = vlog_details.content_id
      and public.is_brand_member(c.brand_id)
  ));
