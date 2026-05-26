-- =====================================================================
-- 0017 — URL de la vidéo publiée (Idée 12)
--
-- Une fois la vidéo en ligne (Reel Instagram, TikTok, etc.), le créateur
-- colle son URL ici pour pouvoir :
--   - cliquer directement sur la vidéo live d'un seul coup
--   - (futur) matcher les insights des APIs réseaux sociaux (Idée 6)
--
-- V1 simple : un seul champ video_url sur contents. Si plus tard on
-- supporte la republication multi-plateforme (Idée 10), on déplacera
-- ça sur une table content_publications.
--
-- Idempotent.
-- =====================================================================

alter table public.contents
  add column if not exists video_url text;

-- Pas de RLS spécifique : hérite des policies contents existantes.
