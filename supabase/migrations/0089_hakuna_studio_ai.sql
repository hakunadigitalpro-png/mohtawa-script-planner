-- Compte de Mariam (propriétaire de la plateforme) : plan Studio, actif,
-- sans date de fin, IA activée. Son abonnement avait été auto-créé en
-- « free / essai 14 jours sans IA » par get_my_plan() (0069), ce qui
-- faisait refuser Krea et les boutons IA sur ses propres marques.
-- Idempotent : upsert sur user_id.

do $$
declare
  v_user uuid;
  r record;
begin
  select id into v_user from auth.users where email = 'hakuna.digitalpro@gmail.com';
  if v_user is null then
    raise exception 'Compte hakuna.digitalpro@gmail.com introuvable';
  end if;

  select plan_id, status, ends_at, ai_enabled into r
  from public.subscriptions where user_id = v_user;
  raise notice 'AVANT : plan=% status=% ends_at=% ai=%',
    r.plan_id, r.status, r.ends_at, r.ai_enabled;

  insert into public.subscriptions (user_id, plan_id, status, ends_at, ai_enabled, granted_by, granted_at, note)
  values (v_user, 'studio', 'active', null, true, v_user, now(), 'Propriétaire de la plateforme')
  on conflict (user_id) do update
    set plan_id    = 'studio',
        status     = 'active',
        ends_at    = null,
        ai_enabled = true,
        granted_by = excluded.granted_by,
        granted_at = now(),
        note       = excluded.note;

  select plan_id, status, ends_at, ai_enabled into r
  from public.subscriptions where user_id = v_user;
  raise notice 'APRÈS : plan=% status=% ends_at=% ai=%',
    r.plan_id, r.status, r.ends_at, r.ai_enabled;
end$$;
