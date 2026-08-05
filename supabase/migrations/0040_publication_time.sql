-- =====================================================================
-- 0040 — Heure de publication par plateforme
--
-- content_publications avait déjà une date par plateforme (migration
-- 0020) — on ajoute l'heure, pour pouvoir programmer par exemple
-- Instagram à 20h et Facebook à 10h le même jour. Nullable : optionnel,
-- la date seule reste valide (juste sans heure précise).
--
-- Idempotent.
-- =====================================================================

alter table public.content_publications
  add column if not exists scheduled_time time;
