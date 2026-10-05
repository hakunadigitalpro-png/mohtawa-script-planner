-- =====================================================================
-- 0054 — Interrupteur IA par marque
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
--
-- « Sur cette marque, on écrit à la main. » Certaines marques ne veulent
-- pas de texte généré — c'est une politique éditoriale, pas une question
-- de droits.
--
-- Le réglage vit sur `brands` et PAS sur `brand_kits` : depuis la 0052,
-- `brand_kits` est ouvert en écriture à `is_brand_writer` (owner, admin ET
-- editor), alors que `brands` est restreint à owner/admin depuis la 0001.
-- Couper l'IA de toute une marque est une décision de gouvernance : elle
-- hérite ainsi du bon niveau de droit sans écrire une seule policy.
-- =====================================================================

alter table public.brands
  add column if not exists ai_enabled boolean not null default true;

-- =====================================================================
-- is_brand_ai_enabled — lue par le garde commun des actions IA.
--
-- SECURITY DEFINER comme `is_brand_member` : l'appelant n'a pas besoin de
-- lire la ligne `brands` pour que le garde tranche, et la fonction reste
-- sans effet de bord.
--
-- Renvoie `true` quand la marque est introuvable : même convention
-- « fail-open » que `check_ai_rate_limit` (lib/ai-guard.ts) — un réglage
-- absent ou cassé ne doit jamais empêcher de travailler, seule une
-- désactivation explicite bloque.
-- =====================================================================

create or replace function public.is_brand_ai_enabled(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select ai_enabled from public.brands where id = b),
    true
  );
$$;

revoke all on function public.is_brand_ai_enabled(uuid) from public;
grant execute on function public.is_brand_ai_enabled(uuid) to authenticated;
