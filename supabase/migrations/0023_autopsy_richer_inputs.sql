-- =====================================================================
-- 0023 — Autopsie : entrées plus riches (capture insights + stats clés)
--
-- Le 1er vrai test a montré que l'autopsie single-vidéo manque de données
-- pour être chirurgicale. On enrichit SANS faire de comparaison
-- cross-vidéos (choix produit) :
--   - insights_image_url   : capture d'écran des insights de la plateforme.
--                            Claude (multimodal) lit la courbe de rétention
--                            + les stats + le label directement dans l'image.
--   - avg_watch_seconds    : vue moyenne en secondes (le vrai signal de
--                            rétention, plus parlant que le % seul).
--   - video_duration_seconds : durée totale → permet de calculer le % vu.
--   - performance_label    : verdict de la plateforme ("plus de vues que
--                            d'habitude" / "dans la moyenne" / "moins").
--                            Permet à l'IA de challenger la prémisse de
--                            l'utilisateur.
--
-- Idempotent.
-- =====================================================================

alter table public.performances
  add column if not exists insights_image_url     text,
  add column if not exists avg_watch_seconds       numeric,
  add column if not exists video_duration_seconds  numeric,
  add column if not exists performance_label        text;

-- Hérite des policies performances existantes (membres de la marque).
