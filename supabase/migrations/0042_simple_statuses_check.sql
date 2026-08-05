-- =====================================================================
-- 0042 — Débloquer les nouveaux statuts post/carrousel/infographie
--
-- contents.status a une contrainte CHECK héritée de 0001_initial.sql qui
-- ne connaît que les statuts vidéo ('idea','script','filming','editing',
-- 'scheduled','published'). Les nouveaux statuts des types simples
-- (SIMPLE_STATUSES, lib/constants.ts) — design, pending_review,
-- needs_revision, approved, programmed, live — étaient donc REJETÉS par
-- Postgres à l'enregistrement (constraint violation), d'où le Plan tab qui
-- refusait de sauvegarder silencieusement.
--
-- Idempotent.
-- =====================================================================

alter table public.contents
  drop constraint if exists contents_status_check;

alter table public.contents
  add constraint contents_status_check
  check (status in (
    'idea', 'script', 'filming', 'editing', 'scheduled', 'published',
    'design', 'pending_review', 'needs_revision', 'approved', 'programmed', 'live'
  ));
