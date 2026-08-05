-- Studio de marque : questionnaire guidé qui génère une stratégie sur mesure
-- (positionnement, audience, voix, messages clés, thèmes de contenu).
-- Une ligne par marque. `answers` = brouillon du questionnaire (autosave,
-- permet de reprendre plus tard). `generated` = la stratégie produite par
-- l'IA (structure JSON, voir GeneratedStrategy dans lib/types.ts).

create table if not exists public.brand_strategies (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  generated jsonb,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.brand_strategies enable row level security;

drop policy if exists "brand_strategies_select" on public.brand_strategies;
create policy "brand_strategies_select" on public.brand_strategies
  for select using (public.is_brand_member(brand_id));

drop policy if exists "brand_strategies_insert" on public.brand_strategies;
create policy "brand_strategies_insert" on public.brand_strategies
  for insert with check (public.is_brand_member(brand_id));

drop policy if exists "brand_strategies_update" on public.brand_strategies;
create policy "brand_strategies_update" on public.brand_strategies
  for update using (public.is_brand_member(brand_id));

drop policy if exists "brand_strategies_delete" on public.brand_strategies;
create policy "brand_strategies_delete" on public.brand_strategies
  for delete using (public.is_brand_member(brand_id));
