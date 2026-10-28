-- La vue 0085 marchait pour brand_members (RLS respectée) mais pas
-- pour auth.users : l'utilisateur `authenticated` n'a pas les droits
-- de SELECT dessus, et avec `security_invoker = on` la jointure
-- renvoyait toujours 0 ligne, donc la liste restait vide.
--
-- On DROP et on recrée la vue avec `security_invoker = off` : elle
-- tourne alors comme son propriétaire (postgres), avec accès à
-- auth.users. On ajoute une CTE qui filtre par membre authentifié
-- pour re-créer la RLS à la main — un utilisateur ne verra JAMAIS
-- de rows en-dehors des marques dont il est membre.

drop view if exists public.brand_members_with_emails;

create view public.brand_members_with_emails
with (security_invoker = off)
as
select
  m.brand_id,
  m.user_id,
  u.email::text as email,
  m.role::text as role,
  m.created_at,
  m.expires_at,
  m.scopes
from public.brand_members m
join auth.users u on u.id = m.user_id
where exists (
  -- L'auteur de la requête doit être membre actif de CETTE marque.
  -- Reproduit la logique de la RLS brand_members, puisqu'on tourne
  -- en SECURITY DEFINER et qu'elle ne s'applique plus naturellement.
  select 1 from public.brand_members me
  where me.brand_id = m.brand_id
    and me.user_id = auth.uid()
    and (me.expires_at is null or me.expires_at > now())
);

grant select on public.brand_members_with_emails to authenticated;

select pg_notify('pgrst', 'reload schema');
