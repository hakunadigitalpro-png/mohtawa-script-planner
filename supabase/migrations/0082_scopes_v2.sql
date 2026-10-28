-- Nouvelle version des défauts par rôle pour `has_brand_scope` :
-- 8 modules au lieu de 4, avec un défaut par rôle plus fin.
--
-- Règles (reflètent lib/scopes.ts) :
--   owner / admin → tous les modules
--   editor        → tous SAUF 'brand_settings' et 'team'
--   viewer        → seulement 'review'
--
-- Un `scopes` posé à la main sur `brand_members` écrase le défaut.

create or replace function public.has_brand_scope(b uuid, s text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.brand_role;
  v_scopes text[];
begin
  select role, scopes into v_role, v_scopes
  from public.brand_members
  where brand_id = b
    and user_id = auth.uid()
    and (expires_at is null or expires_at > now());

  if v_role is null then
    return false;
  end if;

  -- Explicite si posé.
  if v_scopes is not null then
    return s = any(v_scopes);
  end if;

  -- Défaut par rôle (reflet de lib/scopes.ts ROLE_DEFAULTS).
  if v_role in ('owner', 'admin') then
    return s in (
      'contents', 'ads', 'tasks', 'analytics',
      'review', 'ai', 'brand_settings', 'team'
    );
  elsif v_role = 'editor' then
    return s in (
      'contents', 'ads', 'tasks', 'analytics', 'review', 'ai'
    );
  elsif v_role = 'viewer' then
    return s = 'review';
  end if;

  return false;
end$$;

revoke all on function public.has_brand_scope(uuid, text) from public;
grant execute on function public.has_brand_scope(uuid, text) to authenticated;

-- RPC qui renvoie les scopes effectifs du user courant pour une marque
-- (utilisée par le serveur pour filtrer la sidebar en SSR).
create or replace function public.my_brand_scopes(b uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.brand_role;
  v_scopes text[];
begin
  select role, scopes into v_role, v_scopes
  from public.brand_members
  where brand_id = b
    and user_id = auth.uid()
    and (expires_at is null or expires_at > now());

  if v_role is null then
    return array[]::text[];
  end if;

  if v_scopes is not null then
    return v_scopes;
  end if;

  if v_role in ('owner', 'admin') then
    return array[
      'contents', 'ads', 'tasks', 'analytics',
      'review', 'ai', 'brand_settings', 'team'
    ];
  elsif v_role = 'editor' then
    return array['contents', 'ads', 'tasks', 'analytics', 'review', 'ai'];
  elsif v_role = 'viewer' then
    return array['review'];
  end if;

  return array[]::text[];
end$$;

revoke all on function public.my_brand_scopes(uuid) from public;
grant execute on function public.my_brand_scopes(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
