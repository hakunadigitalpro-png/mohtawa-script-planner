-- =====================================================================
-- 0053 — Ce que la 0052 avait laissé ouvert
-- Idempotent. À exécuter APRÈS 0052, dans le SQL Editor de Supabase.
--
-- La 0052 a basculé les écritures sur `is_brand_writer()` pour les tables
-- de contenu et pour les fichiers d'un contenu. Un audit des politiques
-- `storage.objects` et des fonctions `SECURITY DEFINER` en a trouvé quatre
-- qu'elle ne couvrait pas — toutes encore accessibles à un `viewer`.
--
-- Note : `enable_content_sharing`, `disable_content_sharing`,
-- `reorder_storyboard_scenes` et `swap_story_slides` n'ont volontairement
-- rien à faire ici. Elles n'ont aucun contrôle de rôle dans leur corps,
-- mais elles sont déclarées `security invoker` : la RLS s'applique au
-- nom de l'appelant, donc la 0052 les a déjà fermées.
-- =====================================================================

-- =====================================================================
-- 1) Storage : les fichiers de la MARQUE, pas d'un contenu
--
-- Le bucket content-media range aussi le logo et les visuels de la charte
-- sous brand/{brand_id}/ (0031) et les presets de plans sous
-- presets/{brand_id}/ (0029). Ces chemins ne passent pas par un contenu,
-- donc la boucle de la 0052 les a manqués : un client pouvait toujours
-- supprimer le logo de la marque.
-- =====================================================================

drop policy if exists "content_media_brand_insert" on storage.objects;
create policy "content_media_brand_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'brand'
    and public.is_brand_writer(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "content_media_brand_delete" on storage.objects;
create policy "content_media_brand_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'brand'
    and public.is_brand_writer(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "content_media_preset_insert" on storage.objects;
create policy "content_media_preset_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'presets'
    and public.is_brand_writer(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "content_media_preset_delete" on storage.objects;
create policy "content_media_preset_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'presets'
    and public.is_brand_writer(((storage.foldername(name))[2])::uuid)
  );

-- =====================================================================
-- 2) Storage : le bucket privé "insights"
--
-- Les captures de statistiques importées pour l'analyse (0032). La LECTURE
-- reste ouverte à tout membre — un client a le droit de voir les chiffres
-- de ses propres contenus. Seules les écritures se referment.
-- =====================================================================

drop policy if exists "insights_insert" on storage.objects;
create policy "insights_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'insights'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_writer(c.brand_id)
    )
  );

drop policy if exists "insights_update" on storage.objects;
create policy "insights_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'insights'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_writer(c.brand_id)
    )
  );

drop policy if exists "insights_delete" on storage.objects;
create policy "insights_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'insights'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_writer(c.brand_id)
    )
  );

-- =====================================================================
-- 3) set_comment_resolved : ne plus laisser un client clore le travail
--    de l'équipe
--
-- La 0036 autorisait tout membre à marquer n'importe quel fil « résolu ».
-- C'était cohérent tant que tous les membres étaient l'équipe. Depuis que
-- le client est un utilisateur à part entière, il pouvait refermer une
-- remarque interne non traitée — et la faire disparaître des filtres.
--
-- Nouvelle règle : on peut clore un fil si on a le droit d'écrire sur la
-- marque, OU si on en est l'auteur. Un client garde donc la main sur SA
-- propre demande — c'est même l'usage sain : « c'est corrigé, je ferme ».
-- =====================================================================

create or replace function public.set_comment_resolved(
  p_comment_id uuid,
  p_resolved   boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content_id uuid;
  v_author_id  uuid;
  v_brand_id   uuid;
begin
  select content_id, user_id into v_content_id, v_author_id
  from public.content_comments
  where id = p_comment_id;

  if v_content_id is null then
    raise exception 'not_found';
  end if;

  select c.brand_id into v_brand_id
  from public.contents c
  where c.id = v_content_id;

  if v_brand_id is null or not public.is_brand_member(v_brand_id) then
    raise exception 'Forbidden';
  end if;

  if not public.is_brand_writer(v_brand_id)
     and (v_author_id is null or v_author_id <> auth.uid()) then
    raise exception 'Forbidden';
  end if;

  update public.content_comments
  set resolved = p_resolved
  where id = p_comment_id;
end$$;

revoke all on function public.set_comment_resolved(uuid, boolean) from public;
grant execute on function public.set_comment_resolved(uuid, boolean) to authenticated;
