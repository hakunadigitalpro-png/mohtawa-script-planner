-- =====================================================================
-- 0016 — Remarques de montage par scène (Idée 3)
--
-- Ajoute un champ libre `editing_notes` sur storyboard_scenes pour noter
-- les indications de post-production : filtres, effets, transitions
-- spécifiques, musique, sound design, etc.
--
-- Pourquoi par scène (et pas globalement) : un studio / une agence
-- veut pouvoir dire "sur le Plan 03 applique le filtre vintage et coupe
-- net vers le Plan 04". Ce niveau de précision est utile dès qu'on
-- collabore avec un monteur externe.
--
-- Idempotent. À exécuter dans le SQL Editor.
-- =====================================================================

alter table public.storyboard_scenes
  add column if not exists editing_notes text;

-- Pas de RLS spécifique : hérite des policies storyboard_scenes existantes
-- (lecture/écriture pour les membres de la brand parente).
