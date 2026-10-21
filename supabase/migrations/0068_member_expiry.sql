-- Expiration d'accès pour les membres (surtout les clients invités en
-- rôle « viewer ») : au lieu de retirer un membre à la main quand sa
-- mission est terminée, on peut lui poser une date de fin à l'invitation
-- ou plus tard. Un membre expiré n'est plus un membre : la RLS ne le
-- voit plus par is_brand_member(), ses accès disparaissent proprement
-- sans supprimer la ligne (on garde la trace).
--
-- Idempotent : ajout de colonnes « if not exists », remplacement des
-- fonctions.

-- 1) Nouvelle colonne sur brand_members
alter table public.brand_members
  add column if not exists expires_at timestamptz;

comment on column public.brand_members.expires_at is
  'Date de fin d''accès (NULL = illimité). Au-delà, is_brand_member() renvoie faux et toute RLS fondée dessus coupe les accès.';

-- 2) Colonne jumelle sur brand_invitations : « cet accès durera X jours »
--    transmis au membership à l'acceptation.
alter table public.brand_invitations
  add column if not exists member_expires_days int;

comment on column public.brand_invitations.member_expires_days is
  'Nombre de jours de validité de l''accès une fois l''invitation acceptée (NULL = illimité).';

-- 3) is_brand_member : exclut les membres expirés
create or replace function public.is_brand_member(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brand_members
    where brand_id = b
      and user_id = auth.uid()
      and (expires_at is null or expires_at > now())
  );
$$;

-- 4) is_brand_writer : même règle d'expiration
create or replace function public.is_brand_writer(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brand_members
    where brand_id = b
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
      and (expires_at is null or expires_at > now())
  );
$$;

-- 5) create_brand_invitation : accepte un p_expires_days optionnel.
--    On DROP les deux signatures (ancienne à 3 args et nouvelle à 4) pour
--    éviter une surcharge ambiguë côté PostgREST.
drop function if exists public.create_brand_invitation(uuid, public.brand_role, text);
drop function if exists public.create_brand_invitation(uuid, public.brand_role, text, int);

create or replace function public.create_brand_invitation(
  p_brand_id uuid,
  p_role     public.brand_role default 'editor',
  p_note     text default null,
  p_expires_days int default null
)
returns table (id uuid, token text)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_token text;
  v_id    uuid;
begin
  if not exists (
    select 1 from public.brand_members
    where brand_id = p_brand_id and user_id = auth.uid()
      and role in ('owner','admin')
      and (expires_at is null or expires_at > now())
  ) then
    raise exception 'Forbidden: only owner/admin can invite';
  end if;

  v_token := encode(gen_random_bytes(18), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  insert into public.brand_invitations (brand_id, role, token, note, created_by, member_expires_days)
  values (p_brand_id, p_role, v_token, p_note, auth.uid(), p_expires_days)
  returning brand_invitations.id, brand_invitations.token into v_id, v_token;

  return query select v_id, v_token;
end$$;

revoke all on function public.create_brand_invitation(uuid, public.brand_role, text, int) from public;
grant execute on function public.create_brand_invitation(uuid, public.brand_role, text, int) to authenticated;

-- 6) accept_brand_invitation : pose expires_at sur le membership si
--    l'invitation portait un member_expires_days.
create or replace function public.accept_brand_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_expires timestamptz;
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

  v_expires := case
    when v_row.member_expires_days is not null
      then now() + make_interval(days => v_row.member_expires_days)
    else null
  end;

  insert into public.brand_members (brand_id, user_id, role, expires_at)
  values (v_row.brand_id, auth.uid(), v_row.role, v_expires)
  on conflict (brand_id, user_id) do update
    set expires_at = excluded.expires_at;

  update public.brand_invitations
  set used_at = now(),
      used_by = auth.uid()
  where id = v_row.id;

  return jsonb_build_object(
    'brand_id',   v_row.brand_id,
    'role',       v_row.role,
    'expires_at', v_expires
  );
end$$;

-- 7) set_member_expiry : changer la date de fin après coup
--    (owner/admin seulement).
create or replace function public.set_member_expiry(
  p_brand_id   uuid,
  p_user_id    uuid,
  p_expires_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.brand_members
    where brand_id = p_brand_id and user_id = auth.uid()
      and role in ('owner','admin')
      and (expires_at is null or expires_at > now())
  ) then
    raise exception 'Forbidden: only owner/admin can set member expiry';
  end if;

  update public.brand_members
  set expires_at = p_expires_at
  where brand_id = p_brand_id and user_id = p_user_id;
end$$;

revoke all on function public.set_member_expiry(uuid, uuid, timestamptz) from public;
grant execute on function public.set_member_expiry(uuid, uuid, timestamptz) to authenticated;

-- 8) list_brand_members_with_emails : renvoyer aussi expires_at
--    (sans casser l'ancienne shape : nouvelle colonne en queue).
drop function if exists public.list_brand_members_with_emails(uuid);

create or replace function public.list_brand_members_with_emails(p_brand_id uuid)
returns table (
  user_id   uuid,
  email     text,
  role      public.brand_role,
  joined_at timestamptz,
  expires_at timestamptz
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
      and (expires_at is null or expires_at > now())
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select m.user_id, u.email::text, m.role, m.created_at, m.expires_at
  from public.brand_members m
  join auth.users u on u.id = m.user_id
  where m.brand_id = p_brand_id
  order by m.created_at asc;
end$$;

revoke all on function public.list_brand_members_with_emails(uuid) from public;
grant execute on function public.list_brand_members_with_emails(uuid) to authenticated;
