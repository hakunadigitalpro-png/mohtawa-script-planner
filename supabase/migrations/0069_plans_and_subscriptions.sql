-- Plans et abonnements. L'app est ouverte en bêta ; cette migration
-- pose les tables et les RPC sans Stripe : c'est Mariam qui active/
-- prolonge les abonnements à la main depuis /admin.
--
-- Modèle :
--   plans           → catalogue (solo/agence/studio + leurs limites)
--   subscriptions   → UNE row par user (plan_id, dates, ia, status)
--   platform_admins → qui a accès à /admin (seed : Mariam)
--
-- Idempotent : create table if not exists + inserts gardés.

-- 0) is_platform_admin() d'abord — les policies des tables ci-dessous
--    s'appuient dessus, il doit exister avant qu'on les crée. On recrée
--    la table platform_admins juste après pour la seed.
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- 1) Catalogue des plans ------------------------------------------------
create table if not exists public.plans (
  id              text primary key,              -- 'free', 'solo', 'agence', 'studio'
  label           text not null,
  price_tnd       int,                           -- NULL = sur devis (studio futur)
  price_eur       int,
  max_brands      int,                           -- NULL = illimité
  max_members     int,                           -- membres par marque
  max_viewers     int,                           -- clients invités par marque
  ai_default      boolean not null default false,
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

insert into public.plans (id, label, price_tnd, price_eur, max_brands, max_members, max_viewers, ai_default, position)
values
  ('free',   'Gratuit (bêta)', 0,   0,  1,     1,     1,     false, 0),
  ('solo',   'Solo',           29,  9,  1,     1,     1,     false, 1),
  ('agence', 'Agence',         99,  29, 10,    5,     10,    false, 2),
  ('studio', 'Studio',         249, 79, null,  null,  null,  true,  3)
on conflict (id) do update
  set label       = excluded.label,
      price_tnd   = excluded.price_tnd,
      price_eur   = excluded.price_eur,
      max_brands  = excluded.max_brands,
      max_members = excluded.max_members,
      max_viewers = excluded.max_viewers,
      ai_default  = excluded.ai_default,
      position    = excluded.position;

alter table public.plans enable row level security;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to authenticated using (true);

-- 2) Abonnements --------------------------------------------------------
-- status : 'trial' = essai gratuit (ends_at compté)
--          'active' = plan payant en cours
--          'readonly' = fin d'accès dépassée, lecture seule tolérée 30 j
--          'suspended' = tout coupé
create table if not exists public.subscriptions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  plan_id      text not null references public.plans(id),
  status       text not null default 'trial'
               check (status in ('trial','active','readonly','suspended')),
  started_at   timestamptz not null default now(),
  ends_at      timestamptz,                      -- NULL = pas de fin posée
  ai_enabled   boolean not null default false,
  granted_by   uuid references auth.users(id),   -- qui a posé/prolongé
  granted_at   timestamptz not null default now(),
  note         text
);

alter table public.subscriptions enable row level security;

drop policy if exists sub_read_self on public.subscriptions;
create policy sub_read_self on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists sub_admin_all on public.subscriptions;
create policy sub_admin_all on public.subscriptions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- 3) Admins de la plateforme : RLS + seed ------------------------------
alter table public.platform_admins enable row level security;
drop policy if exists admins_read_self on public.platform_admins;
create policy admins_read_self on public.platform_admins
  for select to authenticated
  using (user_id = auth.uid());

-- Seed : Mariam (hakuna.digitalpro@gmail.com). Si l'utilisateur n'existe
-- pas encore sur ce Supabase, aucune ligne n'est insérée (idempotent).
insert into public.platform_admins (user_id)
select id from auth.users where email = 'hakuna.digitalpro@gmail.com'
on conflict (user_id) do nothing;

-- Le plan effectif de l'user, avec statut calculé
-- (si ends_at < now() on bascule virtuellement en readonly).
create or replace function public.get_my_plan()
returns jsonb
language plpgsql
stable
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

  -- Pas d'abonnement = création automatique en bêta gratuite.
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

-- 6) admin_set_subscription() → poser plan + dates + ia pour un user
create or replace function public.admin_set_subscription(
  p_user_id    uuid,
  p_plan_id    text,
  p_status     text default 'active',
  p_ends_at    timestamptz default null,
  p_ai_enabled boolean default null,
  p_note       text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ai boolean;
  v_plan record;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin only';
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    raise exception 'Plan inconnu: %', p_plan_id;
  end if;

  v_ai := coalesce(p_ai_enabled, v_plan.ai_default);

  insert into public.subscriptions (user_id, plan_id, status, ends_at, ai_enabled, granted_by, granted_at, note)
  values (p_user_id, p_plan_id, p_status, p_ends_at, v_ai, auth.uid(), now(), p_note)
  on conflict (user_id) do update
    set plan_id    = excluded.plan_id,
        status     = excluded.status,
        ends_at    = excluded.ends_at,
        ai_enabled = excluded.ai_enabled,
        granted_by = excluded.granted_by,
        granted_at = now(),
        note       = coalesce(excluded.note, public.subscriptions.note);

  return jsonb_build_object('ok', true);
end$$;
revoke all on function public.admin_set_subscription(uuid, text, text, timestamptz, boolean, text) from public;
grant execute on function public.admin_set_subscription(uuid, text, text, timestamptz, boolean, text) to authenticated;

-- 7) admin_list_users() → liste des comptes avec leur abonnement
create or replace function public.admin_list_users()
returns table (
  user_id       uuid,
  email         text,
  created_at    timestamptz,
  plan_id       text,
  status        text,
  ends_at       timestamptz,
  ai_enabled    boolean,
  brand_count   int
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
    (select count(*)::int from public.brand_members bm where bm.user_id = u.id)
  from auth.users u
  left join public.subscriptions s on s.user_id = u.id
  order by u.created_at desc;
end$$;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;
