-- Admin v2 : la liste des comptes remonte aussi le nom, la dernière
-- connexion, la note interne et les marques (nom + rôle) de chaque
-- compte. Même garde qu'avant : platform admin seulement.

drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  user_id         uuid,
  email           text,
  full_name       text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  plan_id         text,
  status          text,
  ends_at         timestamptz,
  ai_enabled      boolean,
  note            text,
  brand_count     int,
  brands          jsonb,
  ai_calls_today  int,
  ai_calls_month  int
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
    nullif(trim(u.raw_user_meta_data->>'full_name'), '')::text,
    u.created_at,
    u.last_sign_in_at,
    s.plan_id,
    coalesce(s.status, 'trial'),
    s.ends_at,
    coalesce(s.ai_enabled, false),
    s.note,
    (select count(*)::int from public.brand_members bm where bm.user_id = u.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'role', bm.role::text)
                       order by b.name)
      from public.brand_members bm
      join public.brands b on b.id = bm.brand_id
      where bm.user_id = u.id
    ), '[]'::jsonb),
    (select count(*)::int from public.ai_usage_log l
      where l.user_id = u.id and l.created_at > now() - interval '24 hours'),
    (select count(*)::int from public.ai_usage_log l
      where l.user_id = u.id and l.created_at > date_trunc('month', now()))
  from auth.users u
  left join public.subscriptions s on s.user_id = u.id
  order by u.created_at desc;
end$$;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

select pg_notify('pgrst', 'reload schema');
