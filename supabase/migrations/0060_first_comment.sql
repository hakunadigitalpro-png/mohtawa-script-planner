-- Migration 0060 — « Premier commentaire » sur un post/carrousel
--
-- La pratique Instagram : poster les hashtags, les mentions ou la mini-FAQ
-- en premier commentaire sous le post plutôt que dans la légende. L'onglet
-- Commentaires de l'éditeur l'écrit à l'avance, pour que l'équipe le
-- colle au moment de publier. C'est un texte libre, nullable, pas structuré.

alter table public.contents
  add column if not exists first_comment text;
