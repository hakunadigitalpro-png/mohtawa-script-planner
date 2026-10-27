-- list_brand_members_with_emails renvoie aussi scopes[] + une RPC
-- `set_member_scopes` pour les mettre à jour (owner/admin).

drop function if exists public.list_brand_members_with_emails(uuid);

create or replace function public.list_brand_members_with_emails(p_brand_id uuid)
returns table (
  user_id    uuid,
  email      text,
  role       public.brand_role,
  joined_at  timestamptz,
  expires_at timestamptz,
  scopes     text[]
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
  select m.user_id, u.email::text, m.role, m.created_at, m.expires_at, m.scopes
  from public.brand_members m
  join auth.users u on u.id = m.user_id
  where m.brand_id = p_brand_id
  order by m.created_at asc;
end$$;

revoke all on function public.list_brand_members_with_emails(uuid) from public;
grant execute on function public.list_brand_members_with_emails(uuid) to authenticated;

create or replace function public.set_member_scopes(
  p_brand_id uuid,
  p_user_id  uuid,
  p_scopes   text[]
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
    raise exception 'Forbidden: only owner/admin can set member scopes';
  end if;

  update public.brand_members
  set scopes = p_scopes
  where brand_id = p_brand_id and user_id = p_user_id;
end$$;

revoke all on function public.set_member_scopes(uuid, uuid, text[]) from public;
grant execute on function public.set_member_scopes(uuid, uuid, text[]) to authenticated;
