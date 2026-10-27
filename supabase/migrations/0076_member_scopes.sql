-- Accès par section pour chaque membre de la marque. Mariam veut voir
-- d'un coup d'œil qui a accès à quoi (comme Kiro CRM) et pouvoir
-- ouvrir Publicités à un client sans tout lui ouvrir.
--
-- Modèle :
--   `scopes text[]` sur `brand_members` : liste des sections visibles.
--   Valeurs connues : 'contents', 'ads', 'tasks', 'analytics'.
--   NULL = défaut selon le rôle (viewer = contents, autres = tout).
--
-- Idempotent : ajout de colonne « if not exists ».

alter table public.brand_members
  add column if not exists scopes text[];

comment on column public.brand_members.scopes is
  'Sections auxquelles le membre a accès (contents, ads, tasks, analytics). NULL = défaut selon le rôle.';

-- Helper côté serveur : « ce user a-t-il accès à cette section de
-- cette marque ? ». Appelable depuis les Server Actions / Pages pour
-- gater les routes. Reproduit la règle par défaut :
--   owner / admin / editor → toutes les sections
--   viewer → seulement 'contents' (= /review + /calendar filtré)
-- Un `scopes` posé la main écrase le défaut.
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

  -- Défaut par rôle.
  if v_role = 'viewer' then
    return s = 'contents';
  end if;

  return true;
end$$;

revoke all on function public.has_brand_scope(uuid, text) from public;
grant execute on function public.has_brand_scope(uuid, text) to authenticated;
