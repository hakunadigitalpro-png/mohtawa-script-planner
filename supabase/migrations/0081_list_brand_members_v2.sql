-- Nouvelle fonction avec un nouveau NOM (list_brand_members_v2) pour
-- forcer PostgREST à repartir d'une page blanche. L'ancienne a été
-- re-refactorée plusieurs fois (0077, 0079, 0080) et reste visiblement
-- en cache quelque part côté client ou côté PostgREST. On abandonne le
-- nom en cause et on passe à v2 ; le frontend pointe sur v2 côté commit
-- qui suit, l'ancienne est gardée en place pour qu'un ancien build qui
-- traîne continue à répondre.

create or replace function public.list_brand_members_v2(p_brand_id uuid)
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

revoke all on function public.list_brand_members_v2(uuid) from public;
grant execute on function public.list_brand_members_v2(uuid)
  to authenticated, anon, service_role;

select pg_notify('pgrst', 'reload schema');
