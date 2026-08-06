-- =====================================================================
-- 0043 — Invitations sans date d'expiration
--
-- brand_invitations.expires_at avait un défaut de 30 jours — trop court
-- pour un client qu'on invite une seule fois et qui doit pouvoir rejoindre
-- quand il veut. On pousse le défaut à 100 ans (= "jamais" en pratique)
-- plutôt que de rendre la colonne nullable : la logique existante
-- (expires_at < now()) continue de marcher sans y toucher.
--
-- N'affecte que les NOUVELLES invitations créées après cette migration.
-- Pour une invitation déjà envoyée, révoque-la et recrée un lien.
--
-- Idempotent.
-- =====================================================================

alter table public.brand_invitations
  alter column expires_at set default (now() + interval '100 years');
