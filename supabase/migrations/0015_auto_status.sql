-- =====================================================================
-- 0015 — Auto-progression du statut selon l'avancement
--
-- Le statut d'une vidéo progresse automatiquement quand certaines étapes
-- sont franchies. Réduit la charge cognitive du créateur ("encore un
-- statut à changer à la main").
--
-- Règles (jamais en arrière, jamais après override manuel) :
--   idea     → script    : checklist.script_ready = true
--   script   → filming   : au moins 1 scène/slot marqué filmed
--   filming  → editing   : toutes les scènes/slots marqués filmed
--   editing  → scheduled : checklist.edited = true ET date dans le futur
--   scheduled → published : reste manuel ("Marquer comme publiée")
--
-- Override : quand l'user change manuellement le statut, on flip
-- contents.auto_status = false → plus d'auto-progression pour cette vidéo.
--
-- Idempotent. À exécuter dans le SQL Editor.
-- =====================================================================

-- 1) Flag override sur contents -----------------------------------------
alter table public.contents
  add column if not exists auto_status boolean not null default true;

-- 2) RPC recompute_content_status ---------------------------------------
-- Appelée par les server actions après une mutation qui peut faire avancer
-- le statut. Renvoie le nouveau statut (ou l'ancien si rien n'a bougé).
create or replace function public.recompute_content_status(p_content_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  v_content record;
  v_checklist jsonb;
  v_total_scenes int;
  v_filmed_scenes int;
  v_total_slides int;
  v_filmed_slides int;
  v_target text;
  v_rank_current int;
  v_rank_target int;
begin
  -- Charge le content (RLS valide l'accès via select)
  select * into v_content from public.contents where id = p_content_id;
  if not found then return null; end if;

  -- Override manuel actif → on ne touche à rien
  if v_content.auto_status is not true then
    return v_content.status;
  end if;

  -- Déjà publiée → terminus, on ne progresse plus
  if v_content.status = 'published' then
    return 'published';
  end if;

  -- Récupère la checklist (jsonb sur reel_details)
  select coalesce(rd.checklist, '{}'::jsonb) into v_checklist
  from public.reel_details rd
  where rd.content_id = p_content_id;
  v_checklist := coalesce(v_checklist, '{}'::jsonb);

  -- Compte scenes / slots avec / sans filmed
  select
    count(*)::int,
    count(*) filter (where filmed = true)::int
    into v_total_scenes, v_filmed_scenes
  from public.storyboard_scenes
  where content_id = p_content_id;

  select
    count(*)::int,
    count(*) filter (where filmed = true)::int
    into v_total_slides, v_filmed_slides
  from public.story_slides
  where content_id = p_content_id;

  -- Calcule le target en partant du statut actuel et en cascadant les
  -- règles vers le haut. Chaque règle ne s'applique que si la précédente
  -- est passée, et ne déclasse jamais (on ne fait que monter).
  v_target := v_content.status;

  -- Règle 1 : idea → script (script_ready coché)
  if v_target = 'idea'
     and coalesce((v_checklist ->> 'script_ready')::boolean, false) then
    v_target := 'script';
  end if;

  -- Règle 2 : script → filming (au moins 1 scène OU slot filmé)
  if v_target in ('idea', 'script')
     and ((v_total_scenes > 0 and v_filmed_scenes >= 1)
          or (v_total_slides > 0 and v_filmed_slides >= 1)) then
    v_target := 'filming';
  end if;

  -- Règle 3 : filming → editing (toutes les scènes OU tous les slots filmés)
  if v_target in ('idea', 'script', 'filming')
     and ((v_total_scenes > 0 and v_filmed_scenes = v_total_scenes)
          or (v_total_slides > 0 and v_filmed_slides = v_total_slides)) then
    v_target := 'editing';
  end if;

  -- Règle 4 : editing → scheduled (edited coché + date dans le futur)
  if v_target in ('idea', 'script', 'filming', 'editing')
     and coalesce((v_checklist ->> 'edited')::boolean, false)
     and v_content.date is not null
     and v_content.date > current_date then
    v_target := 'scheduled';
  end if;

  -- Garde-fou jamais-en-arrière : compare les rangs ordinaux des deux
  -- statuts. Si target <= current, on ne touche pas.
  v_rank_current := case v_content.status
    when 'idea'      then 0
    when 'script'    then 1
    when 'filming'   then 2
    when 'editing'   then 3
    when 'scheduled' then 4
    when 'published' then 5
    else -1
  end;
  v_rank_target := case v_target
    when 'idea'      then 0
    when 'script'    then 1
    when 'filming'   then 2
    when 'editing'   then 3
    when 'scheduled' then 4
    when 'published' then 5
    else -1
  end;

  if v_rank_target <= v_rank_current then
    return v_content.status;
  end if;

  -- Avance le statut
  update public.contents
  set status = v_target
  where id = p_content_id;

  return v_target;
end$$;

revoke all on function public.recompute_content_status(uuid) from public;
grant execute on function public.recompute_content_status(uuid) to authenticated;
