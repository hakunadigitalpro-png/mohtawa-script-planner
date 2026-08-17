-- =====================================================================
-- 0050 — Matériel de tournage disponible (Brand Kit)
--
-- Nouveau champ libre sur brand_kits, au même titre que "audience" et
-- "voice" : décrit une fois le matériel réel de la marque (ex : "anneau
-- lumineux LED, trépied, micro-cravate, fond blanc"), pour que le
-- découpage storyboard IA (filming_guide) donne des conseils
-- lighting/cadrage personnalisés plutôt que génériques.
--
-- Idempotent.
-- =====================================================================

alter table public.brand_kits
  add column if not exists equipment text;
