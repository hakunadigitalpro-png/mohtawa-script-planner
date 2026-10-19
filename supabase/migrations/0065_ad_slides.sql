-- Migration 0065 — Carrousel : une ad peut avoir N diapos (visuel + texte)
--
-- Jusqu'ici une ad portait un seul visuel + un seul texte (champs
-- `visual_url` et `hook` sur `ads`). Les carrousels Meta diffusent 2-10
-- cards, chacune avec son propre visuel ET son propre texte. On ajoute
-- une table `ad_slides` : si vide, l'ad reste à visuel unique (lu depuis
-- les colonnes de `ads`) ; dès qu'il y a 1 ligne, c'est l'ad_slides qui
-- fait foi côté affichage.

create table if not exists public.ad_slides (
  id         uuid primary key default gen_random_uuid(),
  ad_id      uuid not null references public.ads(id) on delete cascade,
  visual_url text,
  text       text,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_slides_ad_idx on public.ad_slides(ad_id, position);

alter table public.ad_slides enable row level security;

-- Même règle d'accès que les ads : on remonte ad → ad_set → campaign →
-- marque, et on vérifie `is_brand_member` / `is_brand_writer`.
drop policy if exists "ad_slides_select" on public.ad_slides;
create policy "ad_slides_select" on public.ad_slides
  for select to authenticated
  using (exists (
    select 1
      from public.ads a
      join public.ad_sets s on s.id = a.ad_set_id
      join public.ad_campaigns c on c.id = s.campaign_id
     where a.id = ad_slides.ad_id
       and public.is_brand_member(c.brand_id)
  ));

drop policy if exists "ad_slides_insert" on public.ad_slides;
create policy "ad_slides_insert" on public.ad_slides
  for insert to authenticated
  with check (exists (
    select 1
      from public.ads a
      join public.ad_sets s on s.id = a.ad_set_id
      join public.ad_campaigns c on c.id = s.campaign_id
     where a.id = ad_slides.ad_id
       and public.is_brand_writer(c.brand_id)
  ));

drop policy if exists "ad_slides_update" on public.ad_slides;
create policy "ad_slides_update" on public.ad_slides
  for update to authenticated
  using (exists (
    select 1
      from public.ads a
      join public.ad_sets s on s.id = a.ad_set_id
      join public.ad_campaigns c on c.id = s.campaign_id
     where a.id = ad_slides.ad_id
       and public.is_brand_writer(c.brand_id)
  ));

drop policy if exists "ad_slides_delete" on public.ad_slides;
create policy "ad_slides_delete" on public.ad_slides
  for delete to authenticated
  using (exists (
    select 1
      from public.ads a
      join public.ad_sets s on s.id = a.ad_set_id
      join public.ad_campaigns c on c.id = s.campaign_id
     where a.id = ad_slides.ad_id
       and public.is_brand_writer(c.brand_id)
  ));

drop trigger if exists ad_slides_touch on public.ad_slides;
create trigger ad_slides_touch before update on public.ad_slides
  for each row execute function public._touch_updated_at();
