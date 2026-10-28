-- Deux évolutions des accès par rôle demandées par Mariam :
--
-- 1. Nouveau rôle `editor_ai` : même défaut qu'un éditeur, mais avec
--    l'IA activée (coût pour Mariam, donc opt-in explicite). Un
--    `editor` simple n'a plus l'IA par défaut.
--
-- 2. Le client (viewer) voit AUSSI les publicités, pour valider les
--    créas et commenter — pas seulement les contenus. On ajoute 'ads'
--    à son défaut.
--
-- Les scopes personnalisés posés à la main (brand_members.scopes)
-- écrasent toujours ces défauts.

alter type public.brand_role add value if not exists 'editor_ai';

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

  if v_scopes is not null then
    return s = any(v_scopes);
  end if;

  -- Défauts par rôle (reflet de lib/scopes.ts).
  if v_role in ('owner', 'admin') then
    return s in (
      'contents', 'ads', 'tasks', 'analytics',
      'review', 'ai', 'brand_settings', 'team'
    );
  elsif v_role = 'editor_ai' then
    return s in (
      'contents', 'ads', 'tasks', 'analytics', 'review', 'ai'
    );
  elsif v_role = 'editor' then
    -- Editor simple : pas d'IA. Mariam décide qui a droit à l'IA
    -- parce que c'est elle qui paie les tokens.
    return s in (
      'contents', 'ads', 'tasks', 'analytics', 'review'
    );
  elsif v_role = 'viewer' then
    -- Le client voit review ET les publicités (pour valider les créas
    -- et commenter), mais pas les contenus internes.
    return s in ('review', 'ads');
  end if;

  return false;
end$$;

revoke all on function public.has_brand_scope(uuid, text) from public;
grant execute on function public.has_brand_scope(uuid, text) to authenticated;

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
  elsif v_role = 'editor_ai' then
    return array['contents', 'ads', 'tasks', 'analytics', 'review', 'ai'];
  elsif v_role = 'editor' then
    return array['contents', 'ads', 'tasks', 'analytics', 'review'];
  elsif v_role = 'viewer' then
    return array['review', 'ads'];
  end if;

  return array[]::text[];
end$$;

revoke all on function public.my_brand_scopes(uuid) from public;
grant execute on function public.my_brand_scopes(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
