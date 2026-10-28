-- Vue de la liste des membres d'une marque + leurs e-mails.
-- Remplace la RPC list_brand_members_* qui, après plusieurs refontes
-- (0077/0079/0080/0081), gardait un cache capricieux côté PostgREST
-- et renvoyait vide. La vue a l'avantage d'être servie directement par
-- PostgREST comme n'importe quelle table, sans cache de signature.
--
-- Sécurité : la vue est marquée `security_invoker = on` (comportement
-- par défaut sur PG 15+). On s'appuie sur la RLS de brand_members
-- (déjà posée, 0001). auth.users n'a pas de RLS, mais la jointure ne
-- renvoie que les rows dont brand_members est lisible → ok.

create or replace view public.brand_members_with_emails
with (security_invoker = on)
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
join auth.users u on u.id = m.user_id;

-- La vue doit être lisible par les utilisateurs connectés — la RLS de
-- brand_members fera le filtrage. On n'autorise QUE le SELECT.
grant select on public.brand_members_with_emails to authenticated;

select pg_notify('pgrst', 'reload schema');
