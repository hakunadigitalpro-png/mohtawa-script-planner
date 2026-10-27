-- Correction : get_my_plan() a été définie `stable` dans 0069 mais fait
-- un INSERT (crée une row « free/trial » pour un user sans abo). Une
-- fonction stable n'a pas le droit de modifier des données → PostgreSQL
-- renvoie une erreur, l'UI affiche « Impossible de lire ton plan » dès
-- qu'une personne sans abo invite un membre ou lance une génération IA.
-- On la refait en VOLATILE (le défaut sans mot-clé).

create or replace function public.get_my_plan()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub  record;
  v_plan record;
  v_status text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select * into v_sub from public.subscriptions where user_id = auth.uid();

  if not found then
    insert into public.subscriptions (user_id, plan_id, status, ends_at, ai_enabled)
    values (auth.uid(), 'free', 'trial', now() + interval '14 days', false)
    returning * into v_sub;
  end if;

  select * into v_plan from public.plans where id = v_sub.plan_id;

  v_status := v_sub.status;
  if v_sub.ends_at is not null and v_sub.ends_at < now() and v_status in ('trial','active') then
    v_status := 'readonly';
  end if;

  return jsonb_build_object(
    'plan_id',     v_sub.plan_id,
    'plan_label',  v_plan.label,
    'status',      v_status,
    'started_at',  v_sub.started_at,
    'ends_at',     v_sub.ends_at,
    'ai_enabled',  v_sub.ai_enabled,
    'max_brands',  v_plan.max_brands,
    'max_members', v_plan.max_members,
    'max_viewers', v_plan.max_viewers
  );
end$$;

revoke all on function public.get_my_plan() from public;
grant execute on function public.get_my_plan() to authenticated;
