-- =====================================================================
-- 0019 — Caption (texte publié avec la vidéo) + nettoyage UX
--
-- Idée 11 (revue de principe) : on retire de l'onglet Plan les champs
-- redondants avec Script (Accroche = Intro, CTA = Outro) et on retire
-- aussi Tags qui n'apportait rien. À la place on ajoute un onglet
-- dédié "Caption" pour le texte qui accompagne la vidéo lors de la
-- publication (hashtags, mention, contexte).
--
-- Côté DB c'est minimal : on ajoute juste une colonne `caption` sur
-- contents. Les anciennes colonnes hook/cta/tags restent en place pour
-- backward compat (Share view, Print page, AI generator legacy) — on
-- les drop quand on aura migré tous les consommateurs.
--
-- Idempotent.
-- =====================================================================

alter table public.contents
  add column if not exists caption text;

-- Pas de RLS spécifique : hérite des policies contents existantes.
