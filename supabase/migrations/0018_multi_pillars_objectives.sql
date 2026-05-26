-- =====================================================================
-- 0018 — Multi-piliers et multi-objectifs par vidéo (Idée 8)
--
-- Une vidéo peut maintenant porter plusieurs piliers et plusieurs
-- objectifs. On utilise des arrays text Postgres natifs (text[]) plutôt
-- que des tables de jonction parce que :
--   - Plus simple à maintenir (moins de RLS, moins de jointures)
--   - Postgres a un index GIN natif pour filtrer sur arrays
--   - Le code applicatif manipule juste des arrays de strings
--
-- STRATÉGIE DE COMPATIBILITÉ :
-- On garde les colonnes singulières `pillar` et `objective` qui sont
-- automatiquement synchronisées sur le PREMIER élément des arrays via un
-- trigger BEFORE INSERT/UPDATE. Ça permet à tout le code legacy
-- (analytics, share, print, dashboard filter) de continuer à marcher
-- sans refactor immédiat. Quand on aura le temps on refactorera ces
-- consommateurs pour lire les arrays directement et on pourra drop les
-- colonnes singulières.
--
-- Idempotent.
-- =====================================================================

-- 1) Ajout des colonnes array (default : array vide, pas NULL)
alter table public.contents
  add column if not exists pillars text[] not null default '{}',
  add column if not exists objectives text[] not null default '{}';

-- 2) Backfill : on remplit l'array à partir du singulier pour les vidéos
-- qui n'ont pas encore d'array setté.
update public.contents
set pillars = array[pillar]
where pillar is not null
  and pillar <> ''
  and (pillars is null or array_length(pillars, 1) is null);

update public.contents
set objectives = array[objective]
where objective is not null
  and objective <> ''
  and (objectives is null or array_length(objectives, 1) is null);

-- 3) Index GIN pour pouvoir filtrer rapidement sur "vidéos qui ont le
-- pilier Marketing" (`where 'Marketing' = any(pillars)`).
create index if not exists contents_pillars_gin
  on public.contents using gin (pillars);

create index if not exists contents_objectives_gin
  on public.contents using gin (objectives);

-- 4) Trigger de synchronisation : à chaque modif des arrays, on met à
-- jour les colonnes singulières avec le 1er élément. Comme ça :
--   - L'analytics et le share view qui lisent contents.pillar/objective
--     continuent de voir le pilier "primaire" (le premier sélectionné)
--   - Les vidéos qui n'avaient qu'un pilier ne changent pas de
--     comportement
create or replace function public.sync_legacy_pillar_objective()
returns trigger
language plpgsql
as $$
begin
  -- nullif(array[1], '') gère le cas array vide → null sur le singulier
  new.pillar    := nullif(coalesce(new.pillars[1], ''), '');
  new.objective := nullif(coalesce(new.objectives[1], ''), '');
  return new;
end$$;

drop trigger if exists contents_sync_legacy_pillar_objective on public.contents;
create trigger contents_sync_legacy_pillar_objective
  before insert or update of pillars, objectives on public.contents
  for each row execute function public.sync_legacy_pillar_objective();
