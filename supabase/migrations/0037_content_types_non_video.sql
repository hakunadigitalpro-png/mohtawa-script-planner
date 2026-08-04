-- =====================================================================
-- 0037 — Ouvrir Kreatly aux formats NON-VIDÉO
--
-- Jusqu'ici `contents.type` était limité aux formats vidéo (reel/story/vlog).
-- On ajoute post / carousel / infographic pour que le client puisse gérer
-- TOUT son mois dans Kreatly (posts, carrousels, infographies), plus besoin
-- de Notion à côté.
--
-- Ces formats "simples" n'ont pas de table détail (pas de script/storyboard) :
-- la légende vit sur contents.caption, les visuels arriveront (morceau 2) dans
-- une table dédiée. Idempotent.
-- =====================================================================

alter table public.contents
  drop constraint if exists contents_type_check;

alter table public.contents
  add constraint contents_type_check
  check (type in ('reel', 'story', 'vlog', 'post', 'carousel', 'infographic'));
