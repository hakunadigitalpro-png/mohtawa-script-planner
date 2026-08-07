-- =====================================================================
-- 0045 — Aligner le vocabulaire de statuts des vidéos sur celui des
-- posts/carrousels/infographies
--
-- Les vidéos (reel/story/vlog) gagnent un statut "Validé" (approved),
-- inséré entre "Montage" et "Programmée", et leur statut final "Publiée"
-- devient "Live" — exactement les mêmes valeurs que SIMPLE_STATUSES
-- (lib/constants.ts). Objectifs :
--   1) Un même vocabulaire pour tous les formats de contenu.
--   2) La nouvelle notification "contenu validé mais pas programmé"
--      (à venir) fonctionne pareil peu importe le format.
--   3) Le passage automatique en Live une fois la date+heure dépassée
--      (recompute_live_statuses, migration 0041) s'applique aussi aux
--      vidéos, pas seulement aux formats simples.
--
-- Aucun changement de contrainte CHECK nécessaire : contents_status_check
-- (migration 0042) autorise déjà 'approved' et 'live' pour toutes les
-- lignes.
--
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

-- 1) Bascule les vidéos déjà "published" vers "live" ---------------------
update public.contents
set status = 'live'
where status = 'published'
  and type in ('reel', 'story', 'vlog');

-- 2) Étend recompute_live_statuses aux vidéos programmées -----------------
create or replace function public.recompute_live_statuses(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_brand_member(p_brand_id) then
    raise exception 'not_authorized';
  end if;

  -- Post / carrousel / infographie : "programmed" → "live"
  update public.contents c
  set status = 'live'
  where c.brand_id = p_brand_id
    and c.status = 'programmed'
    and c.type in ('post', 'carousel', 'infographic')
    and exists (
      select 1 from public.content_publications p
      where p.content_id = c.id
        and p.scheduled_date is not null
        and (p.scheduled_date::timestamp + coalesce(p.scheduled_time, '00:00'::time)) <= now()
    );

  -- Reel / story / vlog : "scheduled" → "live"
  update public.contents c
  set status = 'live'
  where c.brand_id = p_brand_id
    and c.status = 'scheduled'
    and c.type in ('reel', 'story', 'vlog')
    and exists (
      select 1 from public.content_publications p
      where p.content_id = c.id
        and p.scheduled_date is not null
        and (p.scheduled_date::timestamp + coalesce(p.scheduled_time, '00:00'::time)) <= now()
    );
end$$;

revoke all on function public.recompute_live_statuses(uuid) from public;
grant execute on function public.recompute_live_statuses(uuid) to authenticated;
