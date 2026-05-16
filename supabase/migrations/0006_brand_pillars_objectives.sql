-- =====================================================================
-- 0006 — Piliers de contenu + Objectifs gérés par marque
-- - Chaque marque a sa propre liste de piliers (100 % custom).
-- - Chaque marque a ses objectifs, pré-remplis avec 5 défauts.
-- - Les valeurs sur contents.pillar / contents.objective restent en
--   text (compatibilité). Le dropdown vient de ces tables ; le créer/
--   renommer est isolé de l'historique.
-- Idempotent.
-- =====================================================================

-- 1) brand_pillars -----------------------------------------------------
create table if not exists public.brand_pillars (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brands(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  color      text,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create index if not exists brand_pillars_brand_idx
  on public.brand_pillars(brand_id);

alter table public.brand_pillars enable row level security;

drop policy if exists "brand_pillars_select" on public.brand_pillars;
create policy "brand_pillars_select" on public.brand_pillars
  for select to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "brand_pillars_insert" on public.brand_pillars;
create policy "brand_pillars_insert" on public.brand_pillars
  for insert to authenticated
  with check (public.is_brand_member(brand_id));

drop policy if exists "brand_pillars_update" on public.brand_pillars;
create policy "brand_pillars_update" on public.brand_pillars
  for update to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "brand_pillars_delete" on public.brand_pillars;
create policy "brand_pillars_delete" on public.brand_pillars
  for delete to authenticated
  using (public.is_brand_member(brand_id));

-- 2) brand_objectives --------------------------------------------------
create table if not exists public.brand_objectives (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brands(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create index if not exists brand_objectives_brand_idx
  on public.brand_objectives(brand_id);

alter table public.brand_objectives enable row level security;

drop policy if exists "brand_objectives_select" on public.brand_objectives;
create policy "brand_objectives_select" on public.brand_objectives
  for select to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "brand_objectives_insert" on public.brand_objectives;
create policy "brand_objectives_insert" on public.brand_objectives
  for insert to authenticated
  with check (public.is_brand_member(brand_id));

drop policy if exists "brand_objectives_update" on public.brand_objectives;
create policy "brand_objectives_update" on public.brand_objectives
  for update to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "brand_objectives_delete" on public.brand_objectives;
create policy "brand_objectives_delete" on public.brand_objectives
  for delete to authenticated
  using (public.is_brand_member(brand_id));

-- 3) Seed automatique des 5 objectifs par défaut à la création d'une marque
create or replace function public.seed_default_objectives()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.brand_objectives (brand_id, name, position) values
    (new.id, 'Éducation',       1),
    (new.id, 'Personal Brand',  2),
    (new.id, 'Vente',           3),
    (new.id, 'Notoriété',       4),
    (new.id, 'Engagement',      5)
  on conflict (brand_id, name) do nothing;
  return new;
end$$;

drop trigger if exists brands_seed_objectives on public.brands;
create trigger brands_seed_objectives
  after insert on public.brands
  for each row execute function public.seed_default_objectives();

-- 4) Backfill pour les marques existantes (idempotent)
insert into public.brand_objectives (brand_id, name, position)
select b.id, x.name, x.pos
from public.brands b
cross join (values
  ('Éducation',       1),
  ('Personal Brand',  2),
  ('Vente',           3),
  ('Notoriété',       4),
  ('Engagement',      5)
) as x(name, pos)
on conflict (brand_id, name) do nothing;
