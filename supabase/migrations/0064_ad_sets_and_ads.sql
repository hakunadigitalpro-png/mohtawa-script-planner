-- Migration 0064 — Structure Meta : Campagne → Ad sets → Ads
--
-- Jusqu'ici une campagne portait directement ses visuels. Dans la vraie
-- vie Meta (et LinkedIn, TikTok…), une campagne contient 1-N « ad sets »
-- (groupes d'audience / budget), chacun contenant 1-N « ads » (le visuel
-- + le texte réellement diffusé). On modélise ça pour s'y retrouver —
-- surtout quand une campagne tourne sur deux audiences avec deux visuels
-- différents pour A/B tester.
--
-- Les champs ciblage (age/loc/interests) et budget_daily qui vivaient
-- sur la campagne gardent leur place : ils servent de valeurs par
-- défaut quand on crée un ad set, mais chaque ad set peut les redéfinir.
-- Les visuels (ad_campaign_media kind='visual') qui restent attachés à
-- la campagne sont conservés pour l'historique — pas de migration
-- destructive ici.

-- =====================================================================
-- ad_sets
-- =====================================================================

create table if not exists public.ad_sets (
  id         uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  name       text,
  targeting_age        text,
  targeting_location   text,
  targeting_interests  text,
  budget_daily         text,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_sets_campaign_idx on public.ad_sets(campaign_id, position);

alter table public.ad_sets enable row level security;

drop policy if exists "ad_sets_select" on public.ad_sets;
create policy "ad_sets_select" on public.ad_sets
  for select to authenticated
  using (exists (select 1 from public.ad_campaigns c
                 where c.id = ad_sets.campaign_id
                   and public.is_brand_member(c.brand_id)));

drop policy if exists "ad_sets_insert" on public.ad_sets;
create policy "ad_sets_insert" on public.ad_sets
  for insert to authenticated
  with check (exists (select 1 from public.ad_campaigns c
                      where c.id = ad_sets.campaign_id
                        and public.is_brand_writer(c.brand_id)));

drop policy if exists "ad_sets_update" on public.ad_sets;
create policy "ad_sets_update" on public.ad_sets
  for update to authenticated
  using (exists (select 1 from public.ad_campaigns c
                 where c.id = ad_sets.campaign_id
                   and public.is_brand_writer(c.brand_id)));

drop policy if exists "ad_sets_delete" on public.ad_sets;
create policy "ad_sets_delete" on public.ad_sets
  for delete to authenticated
  using (exists (select 1 from public.ad_campaigns c
                 where c.id = ad_sets.campaign_id
                   and public.is_brand_writer(c.brand_id)));

-- =====================================================================
-- ads (le visuel réellement diffusé)
-- =====================================================================

create table if not exists public.ads (
  id         uuid primary key default gen_random_uuid(),
  ad_set_id  uuid not null references public.ad_sets(id) on delete cascade,
  name       text,
  -- Le texte accrocheur / message principal, à côté du visuel.
  hook       text,
  -- URL de l'image/vidéo (uploadée dans le bucket content-media, préfixe
  -- `ad/{campaign_id}/`, comme les visuels existants).
  visual_url text,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ads_ad_set_idx on public.ads(ad_set_id, position);

alter table public.ads enable row level security;

-- Les policies traversent ad_set → campaign pour trouver la marque.
drop policy if exists "ads_select" on public.ads;
create policy "ads_select" on public.ads
  for select to authenticated
  using (exists (select 1
                 from public.ad_sets s
                 join public.ad_campaigns c on c.id = s.campaign_id
                 where s.id = ads.ad_set_id
                   and public.is_brand_member(c.brand_id)));

drop policy if exists "ads_insert" on public.ads;
create policy "ads_insert" on public.ads
  for insert to authenticated
  with check (exists (select 1
                      from public.ad_sets s
                      join public.ad_campaigns c on c.id = s.campaign_id
                      where s.id = ads.ad_set_id
                        and public.is_brand_writer(c.brand_id)));

drop policy if exists "ads_update" on public.ads;
create policy "ads_update" on public.ads
  for update to authenticated
  using (exists (select 1
                 from public.ad_sets s
                 join public.ad_campaigns c on c.id = s.campaign_id
                 where s.id = ads.ad_set_id
                   and public.is_brand_writer(c.brand_id)));

drop policy if exists "ads_delete" on public.ads;
create policy "ads_delete" on public.ads
  for delete to authenticated
  using (exists (select 1
                 from public.ad_sets s
                 join public.ad_campaigns c on c.id = s.campaign_id
                 where s.id = ads.ad_set_id
                   and public.is_brand_writer(c.brand_id)));

-- =====================================================================
-- updated_at triggers
-- =====================================================================

create or replace function public._touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ad_sets_touch on public.ad_sets;
create trigger ad_sets_touch before update on public.ad_sets
  for each row execute function public._touch_updated_at();

drop trigger if exists ads_touch on public.ads;
create trigger ads_touch before update on public.ads
  for each row execute function public._touch_updated_at();
