-- Nouvelle tentative pour la liste des membres : on renvoie `role`
-- en TEXT (plutôt qu'en `public.brand_role` enum). PostgREST a parfois
-- du mal à exposer un enum dans une TABLE return après un drop/recreate
-- et retournait silencieusement une liste vide. En text, pas d'ambiguïté.

drop function if exists public.list_brand_members_with_emails(uuid);

create or replace function public.list_brand_members_with_emails(p_brand_id uuid)
returns table (
  user_id    uuid,
  email      text,
  role       text,
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
  select m.user_id,
         u.email::text,
         m.role::text,
         m.created_at,
         m.expires_at,
         m.scopes
  from public.brand_members m
  join auth.users u on u.id = m.user_id
  where m.brand_id = p_brand_id
  order by m.created_at asc;
end$$;

revoke all on function public.list_brand_members_with_emails(uuid) from public;
grant execute on function public.list_brand_members_with_emails(uuid)
  to authenticated, anon, service_role;

select pg_notify('pgrst', 'reload schema');
