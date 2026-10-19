-- Migration 0062 — Lien externe de prévisualisation (Drive, YouTube, Vimeo…)
--
-- Mariam a souvent la vidéo finie sur Drive AVANT de la préparer dans
-- Kreatly. Au lieu de la ré-uploader, elle colle le lien ici — l'app le
-- convertit en lecteur intégré sur /review pour que le client clique sur
-- Play directement, sans quitter l'écran de validation.
--
-- Nullable : la plupart des contenus n'auront pas de lien (visuels stockés
-- dans content-media). C'est un plus, pas un remplacement.

alter table public.contents
  add column if not exists preview_url text;
