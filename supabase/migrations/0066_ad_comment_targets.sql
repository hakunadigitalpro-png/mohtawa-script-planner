-- Migration 0066 — Commentaires ciblés sur une photo ou un texte d'ad
--
-- Les remarques pouvaient porter sur l'ensemble d'une campagne (fil
-- plat). Pour le Planning, on veut annoter directement UNE photo ou UN
-- texte précis d'une ad : on ajoute deux colonnes optionnelles
-- `target_type` + `target_id` qui désignent la cible. Null = remarque
-- globale, comme avant.
--
-- target_type ∈ ('photo','text') ; target_id = l'id de la ligne ad_slides
-- pour une diapo, l'id de la ligne ads pour la carte unique (sa photo ou
-- son texte).

alter table public.ad_campaign_comments
  add column if not exists target_type text,
  add column if not exists target_id   uuid;

alter table public.ad_campaign_comments
  drop constraint if exists ad_campaign_comments_target_type_chk;
alter table public.ad_campaign_comments
  add constraint ad_campaign_comments_target_type_chk
  check (target_type is null or target_type in ('photo', 'text'));

create index if not exists ad_campaign_comments_target_idx
  on public.ad_campaign_comments(campaign_id, target_type, target_id);
