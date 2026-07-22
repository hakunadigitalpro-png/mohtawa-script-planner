-- =====================================================================
-- 0028 — Piliers de contenu enrichis.
--
-- Un pilier n'était qu'un nom. On lui ajoute la structure d'une vraie
-- stratégie de contenu, pour qu'il serve de référence anti-page-blanche :
--   - objective  : l'objectif du pilier (1 phrase)
--   - rubriques  : les formats/rubriques récurrents (liste)
--   - examples   : des idées de vidéos concrètes (liste)
--   - note       : l'insight / le pourquoi (ex : "génère le plus de portée")
--   - share_pct  : la part visée dans le mix de contenu (ex : 40)
-- Idempotent. Les nouvelles colonnes héritent de la RLS existante (0006).
-- =====================================================================

alter table public.brand_pillars
  add column if not exists objective text,
  add column if not exists rubriques text[] not null default '{}',
  add column if not exists examples  text[] not null default '{}',
  add column if not exists note      text,
  add column if not exists share_pct int check (share_pct is null or (share_pct between 0 and 100));
