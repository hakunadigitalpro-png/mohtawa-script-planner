-- =====================================================================
-- 0022 — Autopsie IA d'une vidéo (Analytics killer feature, V1)
--
-- Croise le TRANSCRIPT (ce qui est dit) avec les STATS (comment ça
-- performe) pour comprendre POURQUOI une vidéo marche ou rate, au niveau
-- du wording. Analyse générée par l'API Claude (Anthropic).
--
-- V1 : saisie manuelle du transcript + des notes de rétention. Les stats
-- sont déjà dans `performances`. V2 : auto-fetch via API plateforme.
--
-- On stocke tout sur `performances` (1:1 avec content, contient déjà les
-- stats) :
--   - transcript        : le texte de la vidéo (collé par l'user)
--   - retention_notes   : description des décrochages ("drop vers 15s")
--   - autopsy_md         : le résultat de l'analyse IA (texte formaté)
--   - autopsy_at         : quand l'autopsie a été générée
--
-- Idempotent.
-- =====================================================================

alter table public.performances
  add column if not exists transcript      text,
  add column if not exists retention_notes text,
  add column if not exists autopsy_md       text,
  add column if not exists autopsy_at       timestamptz;

-- Pas de RLS spécifique : hérite des policies performances existantes
-- (membres de la marque parente).
