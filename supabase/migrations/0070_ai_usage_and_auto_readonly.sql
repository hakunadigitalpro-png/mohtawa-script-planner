-- 1) admin_list_users v2 : ajoute le compte d'appels IA de ce mois et
--    de ce jour pour repérer les comptes qui consomment, dont le coût
--    OpenAI/Gemini dépasse la marge.
-- 2) recompute_subscription_statuses() : passe en 'readonly' les
--    abonnements dont ends_at est dépassé, pour que `admin_list_users`
--    reflète la vérité (get_my_plan le calcule déjà à la volée côté
--    utilisateur). À appeler via une tâche planifiée Coolify (voir doc).
--
-- Idempotent : DROP puis CREATE pour admin_list_users (nouvelle shape).

drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  user_id        uuid,
  email          text,
  created_at     timestamptz,
  plan_id        text,
  status         text,
  ends_at        timestamptz,
  ai_enabled     boolean,
  brand_count    int,
  ai_calls_today int,
  ai_calls_month int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin only';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    s.plan_id,
    coalesce(s.status, 'trial'),
    s.ends_at,
    coalesce(s.ai_enabled, false),
    (select count(*)::int from public.brand_members bm where bm.user_id = u.id),
    (
      select count(*)::int
      from public.ai_usage_log l
      where l.user_id = u.id
        and l.created_at > now() - interval '24 hours'
    ),
    (
      select count(*)::int
      from public.ai_usage_log l
      where l.user_id = u.id
        and l.created_at > date_trunc('month', now())
    )
  from auth.users u
  left join public.subscriptions s on s.user_id = u.id
  order by u.created_at desc;
end$$;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- Fonction appelable par une tâche planifiée. Fait passer les abos dont
-- la date de fin est dépassée en 'readonly' (depuis 'trial' ou 'active')
-- et renvoie le nombre de lignes touchées.
--
-- SECURITY DEFINER car la tâche planifiée appelle via l'anon key : elle
-- n'a pas de user_id d'auth.uid(). On la grante EXECUTE à `anon` pour
-- que ça marche sans clé service, mais on grante seulement l'exécution
-- (pas l'accès aux tables), et la fonction ne fait qu'un UPDATE borné.
create or replace function public.recompute_subscription_statuses()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.subscriptions
  set status = 'readonly'
  where ends_at is not null
    and ends_at < now()
    and status in ('trial', 'active');
  get diagnostics v_count = row_count;
  return v_count;
end$$;
revoke all on function public.recompute_subscription_statuses() from public;
grant execute on function public.recompute_subscription_statuses() to authenticated, anon;
