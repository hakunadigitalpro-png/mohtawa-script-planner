-- Nouveau statut 'completed' pour les campagnes publicitaires :
-- une campagne qui s'est terminée naturellement (sa date de fin est
-- passée, elle a vraiment tourné), distincte de 'stopped' (coupée en
-- cours de route). Mariam veut la différence sur l'écran de pilotage.
--
-- Changement de la contrainte CHECK pour accepter 'completed' en plus
-- des 5 valeurs existantes. Idempotent.

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_status_check;

alter table public.ad_campaigns
  add constraint ad_campaigns_status_check
  check (status in ('draft', 'approved', 'scheduled', 'live', 'stopped', 'completed'));
