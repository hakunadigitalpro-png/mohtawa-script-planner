-- =====================================================================
-- 0025 — Connexions Meta (Instagram / Facebook) par marque
--
-- Stocke le lien OAuth entre une marque Kreatly et un compte Instagram
-- professionnel (Business/Creator) relié à une Page Facebook. Sert de base
-- à l'import des stats (Insights API) ET à la publication (Content
-- Publishing API).
--
-- Une connexion par marque (chaque marque = un client avec SON Instagram).
--
-- ⚠️ SÉCURITÉ — access_token : c'est un secret (permet de lire/publier sur
-- l'IG du client). En beta (utilisateurs de confiance : Mariam + Maryem),
-- la policy SELECT "membre de la marque" est acceptable. AVANT un lancement
-- multi-clients public, durcir : déplacer la lecture du token derrière une
-- fonction SECURITY DEFINER / un client service_role, et n'exposer aux
-- clients qu'une vue sans le token (statut + @username + expiration).
--
-- Idempotent.
-- =====================================================================

create table if not exists public.meta_connections (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brands(id) on delete cascade,
  -- Identité du compte Instagram pro connecté
  ig_user_id       text not null,
  ig_username      text,
  -- Page Facebook reliée (l'IG pro passe par une Page)
  fb_page_id       text,
  fb_page_name     text,
  -- Token longue durée (~60 j) + échéance pour le rafraîchir avant expiration
  access_token     text not null,
  token_expires_at timestamptz,
  scopes           text[] not null default '{}',
  connected_by     uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Une seule connexion Meta par marque (reconnexion = upsert sur ce conflit).
create unique index if not exists meta_connections_brand_unique
  on public.meta_connections(brand_id);

-- ============================ RLS ============================
alter table public.meta_connections enable row level security;

drop policy if exists "meta_connections_select" on public.meta_connections;
create policy "meta_connections_select" on public.meta_connections
  for select to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "meta_connections_insert" on public.meta_connections;
create policy "meta_connections_insert" on public.meta_connections
  for insert to authenticated
  with check (public.is_brand_member(brand_id));

drop policy if exists "meta_connections_update" on public.meta_connections;
create policy "meta_connections_update" on public.meta_connections
  for update to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "meta_connections_delete" on public.meta_connections;
create policy "meta_connections_delete" on public.meta_connections
  for delete to authenticated
  using (public.is_brand_member(brand_id));
