-- =====================================================================
-- 0041 — Passage automatique à "Live" (post/carrousel/infographie)
--
-- Ces types ont leur propre liste de statuts (Idée/Design/En attente de
-- validation/Validé/À réviser/Programmé/Live — lib/constants.ts
-- SIMPLE_STATUSES), différente de celle des vidéos. "Live" doit se
-- déclencher tout seul une fois la date+heure de publication dépassée —
-- pas de tâche planifiée dans cette app (pas d'infra cron), donc on
-- recalcule "à la lecture" : chaque chargement du calendrier/dashboard
-- appelle cette RPC en amont, qui bascule en masse (1 seul UPDATE) tout
-- contenu "programmed" dont la date est passée.
--
-- Idempotent (ne touche que les lignes encore à "programmed").
-- =====================================================================

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
end$$;

revoke all on function public.recompute_live_statuses(uuid) from public;
grant execute on function public.recompute_live_statuses(uuid) to authenticated;
