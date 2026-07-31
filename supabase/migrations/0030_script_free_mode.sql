-- =====================================================================
-- 0030 — Mode d'écriture du script Reel : guidé ou libre.
--
-- Un interrupteur par vidéo : soit le script guidé (Accroche / Corps /
-- Outro), soit un script libre (un seul bloc où on écrit comme on veut).
-- On mémorise le choix par vidéo. Le texte du mode libre réutilise la
-- colonne script_full (le « script complet »).
-- Idempotent.
-- =====================================================================

alter table public.reel_details
  add column if not exists script_free_mode boolean not null default false;
