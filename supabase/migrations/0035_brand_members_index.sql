-- =====================================================================
-- 0035 — Index manquant sur brand_members(user_id)
--
-- La PK de brand_members est (brand_id, user_id). La requête « lister mes
-- marques » (brands/page.tsx) filtre sur user_id SEUL → user_id étant la 2e
-- colonne de la PK, l'index PK n'est pas utilisable comme préfixe → seq scan.
-- Impact faible aujourd'hui (petite table) mais index légitimement absent.
--
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

create index if not exists brand_members_user_idx
  on public.brand_members(user_id);
