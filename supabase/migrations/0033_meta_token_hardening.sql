-- =====================================================================
-- 0033 — Cloisonner le token Meta/Instagram (durcissement sécurité)
--
-- Problème (cf. AUDIT-QUALITE.md) : la policy SELECT de `meta_connections`
-- (0025) autorisait TOUT membre de la marque — y compris un `viewer` — à
-- lire la ligne entière via PostgREST, donc `access_token` (secret qui permet
-- de lire ET publier sur l'Instagram du client).
--
-- Correctif (100 % base de données — aucune fonctionnalité app ne lit encore
-- cette table, donc aucune régression) :
--   1) une VUE publique sans le token (membres) ;
--   2) une FONCTION qui rend le token aux owner/admin seulement ;
--   3) retrait de l'accès direct EN LECTURE à la table (le token ne transite
--      plus par l'API).
--
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

-- 1) Vue publique : toutes les colonnes SAUF access_token, filtrée par
--    appartenance à la marque. Vue SECURITY DEFINER (défaut) → le WHERE
--    is_brand_member() fait le filtrage par utilisateur.
create or replace view public.meta_connections_public as
  select
    id,
    brand_id,
    ig_user_id,
    ig_username,
    fb_page_id,
    fb_page_name,
    token_expires_at,
    scopes,
    connected_by,
    created_at,
    updated_at
  from public.meta_connections
  where public.is_brand_member(brand_id);

revoke all on public.meta_connections_public from anon;
grant select on public.meta_connections_public to authenticated;

-- 2) Le token : réservé owner/admin, via une fonction explicite.
create or replace function public.get_meta_access_token(p_brand_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from public.brand_members
    where brand_id = p_brand_id
      and user_id = auth.uid()
      and role in ('owner','admin')
  ) then
    raise exception 'Forbidden: seul un owner/admin peut lire le token Meta';
  end if;

  select access_token into v_token
  from public.meta_connections
  where brand_id = p_brand_id;

  return v_token;
end$$;

revoke all on function public.get_meta_access_token(uuid) from public;
grant execute on function public.get_meta_access_token(uuid) to authenticated;

-- 3) Retrait de l'accès direct EN LECTURE à la table : le token n'est plus
--    jamais renvoyé par l'API PostgREST. La lecture passe désormais par la vue
--    (sans token) ou par la fonction (token, owner/admin). Les policies
--    INSERT/UPDATE/DELETE (écriture par le futur flux OAuth) restent en place.
drop policy if exists "meta_connections_select" on public.meta_connections;
revoke select on public.meta_connections from anon, authenticated;
