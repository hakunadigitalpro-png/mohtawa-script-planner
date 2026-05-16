-- =====================================================================
-- 0007 — Supprimer le seed automatique des 5 objectifs par défaut.
-- Chaque marque démarre avec une liste vide ; le propriétaire ajoute
-- ses propres objectifs.
-- Idempotent.
-- =====================================================================

-- 1) Drop the trigger and its function so nouvelles marques = liste vide
drop trigger if exists brands_seed_objectives on public.brands;
drop function if exists public.seed_default_objectives();

-- 2) Nettoyage one-shot des 5 défauts déjà injectés par 0006.
--    Note : si un utilisateur a explicitement nommé un objectif comme
--    « Éducation » ou « Vente », il sera aussi supprimé ; il pourra le
--    recréer manuellement. C'est volontaire pour repartir clean.
delete from public.brand_objectives
where name in ('Éducation', 'Personal Brand', 'Vente', 'Notoriété', 'Engagement');
