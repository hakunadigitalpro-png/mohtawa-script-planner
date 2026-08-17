-- =====================================================================
-- 0051 — Matériel de tournage : par setup, pas par marque
--
-- Correction de la migration 0050 (brand_kits.equipment) : le matériel
-- dépend du LIEU de tournage, pas de la marque entière — une même marque
-- peut avoir un setup équipé (anneau lumineux, trépied) et un autre sans
-- rien (face fenêtre, lumière naturelle). Le champ se déplace donc sur
-- brand_scene_presets, un par setup ("Mes setups").
--
-- brand_kits.equipment n'est PAS supprimée (jamais de colonne droppée —
-- convention du projet) : elle devient simplement inutilisée côté code.
--
-- Idempotent.
-- =====================================================================

alter table public.brand_scene_presets
  add column if not exists equipment text;
