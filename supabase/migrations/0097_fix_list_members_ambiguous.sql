-- `list_brand_members_with_emails` échouait à CHAQUE appel depuis 0080 :
--   column reference "user_id" is ambiguous
-- Le RETURNS TABLE déclare `user_id` et `expires_at`, et le contrôle d'accès les
-- citait sans préfixe. Les appelants lisent `data ?? []` : l'erreur passait pour
-- une liste vide. D'où « Invite d'abord ton client » alors que le client existe,
-- des e-mails sans destinataire, des tâches sans personne à qui les assigner, des
-- limites de plan jamais atteintes.
--
-- Même signature, seul le contrôle d'accès change (colonnes préfixées).

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
    select 1 from public.brand_members me
    where me.brand_id = p_brand_id
      and me.user_id = auth.uid()
      and (me.expires_at is null or me.expires_at > now())
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
  to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
