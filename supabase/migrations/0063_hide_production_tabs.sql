-- Migration 0063 — Masquer Script + Storyboard quand la vidéo est déjà prête
--
-- Quand on relie une vidéo externe (Drive, YouTube, Vimeo) à un contenu, le
-- script et le storyboard deviennent inutiles — la vidéo existe déjà. On
-- ajoute un drapeau par contenu pour pouvoir cacher ces deux onglets dans
-- l'éditeur sans effacer leur contenu éventuel.

alter table public.contents
  add column if not exists hide_production_tabs boolean not null default false;
