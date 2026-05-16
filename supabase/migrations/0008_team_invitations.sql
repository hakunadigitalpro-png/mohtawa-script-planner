-- =====================================================================
-- 0008 — Team invitations (lien magique copiable)
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
--
-- L'owner / admin d'une brand génère un lien d'invitation.
-- Le lien (token base64url) est copié et envoyé via le canal de son choix
-- (WhatsApp, mail manuel, Slack, etc.). L'invité connecté l'accepte → il
-- est ajouté à `brand_members` avec le rôle pré-défini.
-- =====================================================================

-- 1) Table brand_invitations ------------------------------------------
create table if not exists public.brand_invitations (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  role        public.brand_role not null default 'editor',
  token       text not null unique,
  note        text,  -- libre : "pour Mariam (graphiste)", facultatif
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days'),
  used_at     timestamptz,
  used_by     uuid references auth.users(id) on delete set null
);

create index if not exists brand_invitations_brand_idx
  on public.brand_invitations(brand_id);

create index if not exists brand_invitations_token_idx
  on public.brand_invitations(token)
  where used_at is null;

-- 2) RLS ----------------------------------------------------------------
alter table public.brand_invitations enable row level security;

-- Membres de la brand peuvent voir les invitations qui leur sont liées
drop policy if exists "invitations_select_members" on public.brand_invitations;
create policy "invitations_select_members" on public.brand_invitations
  for select to authenticated
  using (public.is_brand_member(brand_id));

-- Owner / Admin peuvent créer
drop policy if exists "invitations_insert_owner_admin" on public.brand_invitations;
create policy "invitations_insert_owner_admin" on public.brand_invitations
  for insert to authenticated
  with check (
    exists (
      select 1 from public.brand_members m
      where m.brand_id = brand_invitations.brand_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- Owner / Admin peuvent supprimer (révoquer)
drop policy if exists "invitations_delete_owner_admin" on public.brand_invitations;
create policy "invitations_delete_owner_admin" on public.brand_invitations
  for delete to authenticated
  using (
    exists (
      select 1 from public.brand_members m
      where m.brand_id = brand_invitations.brand_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- 3) RPC : create_brand_invitation -------------------------------------
-- Génère un token base64url et insère la row. Renvoie (id, token).
create or replace function public.create_brand_invitation(
  p_brand_id uuid,
  p_role     public.brand_role default 'editor',
  p_note     text default null
)
returns table (id uuid, token text)
language plpgsql
security invoker
as $$
declare
  v_token text;
  v_id    uuid;
begin
  -- Vérif ceinture-bretelles : seul owner/admin appelle (RLS le confirme aussi)
  if not exists (
    select 1 from public.brand_members
    where brand_id = p_brand_id and user_id = auth.uid()
      and role in ('owner','admin')
  ) then
    raise exception 'Forbidden: only owner/admin can invite';
  end if;

  v_token := encode(gen_random_bytes(18), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  insert into public.brand_invitations (brand_id, role, token, note, created_by)
  values (p_brand_id, p_role, v_token, p_note, auth.uid())
  returning brand_invitations.id, brand_invitations.token into v_id, v_token;

  return query select v_id, v_token;
end$$;

revoke all on function public.create_brand_invitation(uuid, public.brand_role, text) from public;
grant execute on function public.create_brand_invitation(uuid, public.brand_role, text) to authenticated;

-- 4) RPC : get_invitation_preview --------------------------------------
-- Affiche les infos d'une invitation à un user (connecté) AVANT acceptation
-- pour qu'il sache où il va atterrir. SECURITY DEFINER car le user n'est
-- pas encore membre de la brand.
create or replace function public.get_invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_row record;
  v_brand_name text;
  v_inviter_email text;
begin
  if p_token is null or length(p_token) < 10 then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select i.*, b.name as brand_name
  into v_row
  from public.brand_invitations i
  join public.brands b on b.id = i.brand_id
  where i.token = p_token
  limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if v_row.used_at is not null then
    return jsonb_build_object('error', 'already_used');
  end if;

  if v_row.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  select email into v_inviter_email
  from auth.users where id = v_row.created_by;

  return jsonb_build_object(
    'brand_id',     v_row.brand_id,
    'brand_name',   v_row.brand_name,
    'role',         v_row.role,
    'inviter',      v_inviter_email,
    'expires_at',   v_row.expires_at,
    'note',         v_row.note
  );
end$$;

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to authenticated;

-- 5) RPC : accept_brand_invitation -------------------------------------
-- Ajoute auth.uid() comme membre + marque l'invitation comme utilisée.
-- SECURITY DEFINER car le user n'est pas encore membre de la brand au moment
-- de l'appel, donc RLS bloquerait l'insert.
create or replace function public.accept_brand_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.brand_invitations
  where token = p_token
  limit 1;

  if not found then
    raise exception 'Invitation introuvable';
  end if;

  if v_row.used_at is not null then
    raise exception 'Invitation déjà utilisée';
  end if;

  if v_row.expires_at < now() then
    raise exception 'Invitation expirée';
  end if;

  -- Idempotent : si déjà membre, on met juste l'invitation à "used"
  insert into public.brand_members (brand_id, user_id, role)
  values (v_row.brand_id, auth.uid(), v_row.role)
  on conflict (brand_id, user_id) do nothing;

  update public.brand_invitations
  set used_at = now(),
      used_by = auth.uid()
  where id = v_row.id;

  return jsonb_build_object(
    'brand_id',   v_row.brand_id,
    'role',       v_row.role
  );
end$$;

revoke all on function public.accept_brand_invitation(text) from public;
grant execute on function public.accept_brand_invitation(text) to authenticated;

-- 6) RPC : update_member_role ------------------------------------------
-- Owner/Admin peut promouvoir/rétrograder.
-- Garde-fou : on ne peut pas se rétrograder soi-même si on est le SEUL owner.
create or replace function public.update_member_role(
  p_brand_id uuid,
  p_user_id  uuid,
  p_role     public.brand_role
)
returns void
language plpgsql
security invoker
as $$
declare
  v_owner_count int;
  v_target_role public.brand_role;
begin
  if not exists (
    select 1 from public.brand_members
    where brand_id = p_brand_id and user_id = auth.uid()
      and role in ('owner','admin')
  ) then
    raise exception 'Forbidden';
  end if;

  -- Si on rétrograde un owner, vérifier qu'il en reste au moins un
  select role into v_target_role
  from public.brand_members
  where brand_id = p_brand_id and user_id = p_user_id;

  if v_target_role = 'owner' and p_role <> 'owner' then
    select count(*) into v_owner_count
    from public.brand_members
    where brand_id = p_brand_id and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'Au moins un owner doit rester';
    end if;
  end if;

  update public.brand_members
  set role = p_role
  where brand_id = p_brand_id and user_id = p_user_id;
end$$;

revoke all on function public.update_member_role(uuid, uuid, public.brand_role) from public;
grant execute on function public.update_member_role(uuid, uuid, public.brand_role) to authenticated;

-- 7) RPC : remove_member -----------------------------------------------
-- Garde-fou : on ne peut pas retirer le dernier owner.
create or replace function public.remove_brand_member(
  p_brand_id uuid,
  p_user_id  uuid
)
returns void
language plpgsql
security invoker
as $$
declare
  v_owner_count int;
  v_target_role public.brand_role;
begin
  -- Self-leave (un user peut toujours partir) OU owner/admin retirent un autre
  if auth.uid() <> p_user_id and not exists (
    select 1 from public.brand_members
    where brand_id = p_brand_id and user_id = auth.uid()
      and role in ('owner','admin')
  ) then
    raise exception 'Forbidden';
  end if;

  select role into v_target_role
  from public.brand_members
  where brand_id = p_brand_id and user_id = p_user_id;

  if v_target_role = 'owner' then
    select count(*) into v_owner_count
    from public.brand_members
    where brand_id = p_brand_id and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'Au moins un owner doit rester';
    end if;
  end if;

  delete from public.brand_members
  where brand_id = p_brand_id and user_id = p_user_id;
end$$;

revoke all on function public.remove_brand_member(uuid, uuid) from public;
grant execute on function public.remove_brand_member(uuid, uuid) to authenticated;

-- 8) RPC : list_brand_members_with_emails ------------------------------
-- Retourne la liste des membres avec leurs emails (RLS empêche normalement
-- l'accès direct à auth.users → on passe par cette RPC SECURITY DEFINER).
create or replace function public.list_brand_members_with_emails(p_brand_id uuid)
returns table (
  user_id uuid,
  email   text,
  role    public.brand_role,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.brand_members
    where brand_id = p_brand_id and user_id = auth.uid()
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select bm.user_id, u.email::text, bm.role, bm.created_at
  from public.brand_members bm
  join auth.users u on u.id = bm.user_id
  where bm.brand_id = p_brand_id
  order by bm.created_at asc;
end$$;

revoke all on function public.list_brand_members_with_emails(uuid) from public;
grant execute on function public.list_brand_members_with_emails(uuid) to authenticated;
