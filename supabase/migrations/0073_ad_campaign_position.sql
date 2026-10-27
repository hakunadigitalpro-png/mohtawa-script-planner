-- Position manuelle sur les campagnes publicitaires : Mariam veut
-- pouvoir glisser une campagne avant une autre dans le Planning, sans
-- changer leurs dates. On stocke un entier `position`, hiérarchie par
-- marque, et on trie par ça (fallback date_start si position NULL).
--
-- Backfill : on initialise `position` à l'ordre chronologique actuel
-- par marque (plus ancienne = plus haut), pour que la liste ne saute
-- pas la première fois qu'on applique la migration.

alter table public.ad_campaigns
  add column if not exists position int;

-- Backfill : row_number() par brand, trié comme avant (date_start
-- croissante, puis created_at croissante, nulls en fin).
with ranked as (
  select
    id,
    row_number() over (
      partition by brand_id
      order by date_start asc nulls last, created_at asc
    ) * 100 as pos
  from public.ad_campaigns
  where position is null
)
update public.ad_campaigns c
set position = ranked.pos
from ranked
where ranked.id = c.id;

create index if not exists ad_campaigns_brand_position_idx
  on public.ad_campaigns(brand_id, position);

comment on column public.ad_campaigns.position is
  'Ordre manuel dans le Planning. Posé au backfill d''après la date, modifié par le drag utilisateur.';
