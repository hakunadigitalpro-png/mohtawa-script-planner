-- =====================================================================
-- 0052 — Boucle de validation client
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
--
-- Trois choses, dans cet ordre :
--
--   1. `is_brand_writer()` — jusqu'ici TOUTES les écritures passaient par
--      `is_brand_member()`, qui ne distingue pas les rôles. Un `viewer`
--      (le client invité) pouvait donc modifier ET supprimer n'importe quel
--      contenu de la marque, ses visuels, ses performances. Les boutons
--      étaient cachés dans l'interface — ce n'est pas une protection.
--
--   2. `contents.approved_by` / `approved_at` — la validation d'un client
--      est une preuve ; sans trace, elle ne vaut rien en cas de litige.
--
--   3. `client_review_content()` — la SEULE écriture laissée au client.
--      Volontairement une RPC et pas une policy : une policy valide des
--      VALEURS DE LIGNE, pas les colonnes touchées. Un `WITH CHECK
--      (status in ('approved','needs_revision'))` laisserait passer un
--      UPDATE qui change le statut ET réécrit le titre, la date et la
--      légende dans la même requête. Même raisonnement que
--      `set_comment_resolved()` (0036), dont cette fonction est calquée.
-- =====================================================================

-- =====================================================================
-- 1) is_brand_writer : membre AVEC droit d'écriture
-- =====================================================================

create or replace function public.is_brand_writer(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brand_members
    where brand_id = b
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

revoke all on function public.is_brand_writer(uuid) from public;
grant execute on function public.is_brand_writer(uuid) to authenticated;

-- =====================================================================
-- 2) Politiques d'écriture : is_brand_member → is_brand_writer
--
-- La LECTURE reste ouverte à tout membre (le client doit voir le planning).
-- Seules les écritures se referment. `content_comments` est volontairement
-- ABSENTE de ce verrouillage : commenter est précisément ce qu'un client
-- vient faire.
-- =====================================================================

-- --- contents ---------------------------------------------------------
drop policy if exists "contents_insert_members" on public.contents;
create policy "contents_insert_members" on public.contents
  for insert to authenticated
  with check (public.is_brand_writer(brand_id) and user_id = auth.uid());

drop policy if exists "contents_update_members" on public.contents;
create policy "contents_update_members" on public.contents
  for update to authenticated
  using (public.is_brand_writer(brand_id));

drop policy if exists "contents_delete_members" on public.contents;
create policy "contents_delete_members" on public.contents
  for delete to authenticated
  using (public.is_brand_writer(brand_id));

-- --- Tables filles d'un contenu (clé content_id) ----------------------
-- Même boucle que 0001_initial.sql, étendue aux tables ajoutées depuis
-- (story_slides 0004, vlog_details 0020, content_media 0038,
-- content_publications 0019, content_checklist_items 0011).
do $$
declare
  t text;
begin
  foreach t in array array[
    'reel_details', 'story_details', 'storyboard_scenes', 'performances',
    'story_slides', 'vlog_details', 'content_media',
    'content_publications', 'content_checklist_items'
  ] loop
    -- Les noms de policies ne sont pas uniformes dans l'historique :
    -- 0001 utilise "<table>_insert", 0019 "publications_insert_members".
    -- On retire les deux formes avant de recréer.
    execute format($f$drop policy if exists "%s_insert" on public.%I$f$, t, t);
    execute format($f$drop policy if exists "%s_update" on public.%I$f$, t, t);
    execute format($f$drop policy if exists "%s_delete" on public.%I$f$, t, t);

    execute format($f$create policy "%s_insert" on public.%I
      for insert to authenticated
      with check (exists (select 1 from public.contents c
                          where c.id = %I.content_id
                            and public.is_brand_writer(c.brand_id)))$f$, t, t, t);

    execute format($f$create policy "%s_update" on public.%I
      for update to authenticated
      using (exists (select 1 from public.contents c
                     where c.id = %I.content_id
                       and public.is_brand_writer(c.brand_id)))$f$, t, t, t);

    execute format($f$create policy "%s_delete" on public.%I
      for delete to authenticated
      using (exists (select 1 from public.contents c
                     where c.id = %I.content_id
                       and public.is_brand_writer(c.brand_id)))$f$, t, t, t);
  end loop;
end$$;

-- content_publications portait des policies au nom différent (0019) :
-- sans ce nettoyage, les anciennes resteraient actives EN PLUS des
-- nouvelles, et PostgreSQL applique un OU entre policies permissives —
-- le verrou serait sans effet.
drop policy if exists "publications_insert_members" on public.content_publications;
drop policy if exists "publications_update_members" on public.content_publications;
drop policy if exists "publications_delete_members" on public.content_publications;

-- --- Tables de la marque (clé brand_id) -------------------------------
-- `meta_connections` est volontairement absente : 0033 l'a déjà restreinte
-- à owner/admin, la rouvrir aux editors serait un recul.
do $$
declare
  t text;
begin
  foreach t in array array[
    'brand_pillars', 'brand_objectives', 'brand_kits',
    'brand_strategies', 'brand_scene_presets'
  ] loop
    execute format($f$drop policy if exists "%s_insert" on public.%I$f$, t, t);
    execute format($f$drop policy if exists "%s_update" on public.%I$f$, t, t);
    execute format($f$drop policy if exists "%s_delete" on public.%I$f$, t, t);

    execute format($f$create policy "%s_insert" on public.%I
      for insert to authenticated
      with check (public.is_brand_writer(brand_id))$f$, t, t);

    execute format($f$create policy "%s_update" on public.%I
      for update to authenticated
      using (public.is_brand_writer(brand_id))$f$, t, t);

    execute format($f$create policy "%s_delete" on public.%I
      for delete to authenticated
      using (public.is_brand_writer(brand_id))$f$, t, t);
  end loop;
end$$;

-- brand_scene_presets portait "scene_presets_*" (0021).
drop policy if exists "scene_presets_insert" on public.brand_scene_presets;
drop policy if exists "scene_presets_update" on public.brand_scene_presets;
drop policy if exists "scene_presets_delete" on public.brand_scene_presets;

-- --- Storage : les fichiers eux-mêmes ---------------------------------
-- Sans ça, le client ne pourrait plus supprimer la LIGNE d'un visuel mais
-- pourrait toujours supprimer le FICHIER dans le bucket.
drop policy if exists "content_media_insert" on storage.objects;
create policy "content_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_writer(c.brand_id)
    )
  );

drop policy if exists "content_media_update" on storage.objects;
create policy "content_media_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_writer(c.brand_id)
    )
  );

drop policy if exists "content_media_delete" on storage.objects;
create policy "content_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_writer(c.brand_id)
    )
  );

-- =====================================================================
-- 3) Traçabilité de la validation
-- =====================================================================

alter table public.contents
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz;

-- =====================================================================
-- 4) Ancrer un commentaire sur un visuel de carrousel
--
-- 0009 ne connaissait que 'plan', 'script', 'scene' (storyboard) et
-- 'slide' (slot de story). Un carrousel n'avait aucune ancre : tout retour
-- client atterrissait sur 'plan'/'general'. On ajoute 'media', dont le
-- target_id est un content_media.id.
-- =====================================================================

alter table public.content_comments
  drop constraint if exists content_comments_target_type_check;

alter table public.content_comments
  add constraint content_comments_target_type_check
  check (target_type in ('plan', 'script', 'scene', 'slide', 'media'));

-- =====================================================================
-- 5) client_review_content : la seule écriture laissée au client
--
-- Décision du client + commentaire éventuel dans UNE transaction : un
-- « je demande une modif' » sans le commentaire qui l'explique ne doit
-- jamais pouvoir exister.
-- =====================================================================

create or replace function public.client_review_content(
  p_content_id uuid,
  p_decision   text,              -- 'approve' | 'revise'
  p_comment    text default null,
  p_target_type text default 'plan',
  p_target_id  text default 'general'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_status   text;
begin
  if p_decision not in ('approve', 'revise') then
    raise exception 'Invalid decision';
  end if;

  select brand_id, status into v_brand_id, v_status
  from public.contents
  where id = p_content_id;

  if v_brand_id is null then
    raise exception 'not_found';
  end if;

  -- Tout membre de la marque peut donner son avis — y compris l'équipe,
  -- qui relit parfois avant le client. C'est le seul droit d'écriture que
  -- `is_brand_member` conserve après cette migration.
  if not public.is_brand_member(v_brand_id) then
    raise exception 'Forbidden';
  end if;

  -- On ne valide que ce qui a été explicitement soumis. Sans ce garde-fou,
  -- un client pourrait valider une idée encore en cours de design, ou
  -- re-valider un contenu déjà programmé et le faire reculer d'une étape.
  if v_status <> 'pending_review' then
    raise exception 'not_pending';
  end if;

  if p_decision = 'approve' then
    update public.contents
    set status      = 'approved',
        approved_by = auth.uid(),
        approved_at = now()
    where id = p_content_id;
  else
    update public.contents
    set status      = 'needs_revision',
        approved_by = null,
        approved_at = null
    where id = p_content_id;
  end if;

  if p_comment is not null and char_length(trim(p_comment)) > 0 then
    insert into public.content_comments (
      content_id, target_type, target_id, user_id, body
    ) values (
      p_content_id,
      coalesce(p_target_type, 'plan'),
      coalesce(p_target_id, 'general'),
      auth.uid(),
      left(trim(p_comment), 2000)
    );
  end if;
end$$;

revoke all on function public.client_review_content(uuid, text, text, text, text) from public;
grant execute on function public.client_review_content(uuid, text, text, text, text) to authenticated;

-- =====================================================================
-- 6) submit_for_review : le pendant côté équipe
--
-- Sans ça la boucle n'a pas de début — rien ne mettait jamais un contenu
-- en 'pending_review'.
-- =====================================================================

create or replace function public.submit_for_review(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
begin
  select brand_id into v_brand_id
  from public.contents
  where id = p_content_id;

  if v_brand_id is null then
    raise exception 'not_found';
  end if;

  if not public.is_brand_writer(v_brand_id) then
    raise exception 'Forbidden';
  end if;

  update public.contents
  set status      = 'pending_review',
      approved_by = null,
      approved_at = null
  where id = p_content_id;
end$$;

revoke all on function public.submit_for_review(uuid) from public;
grant execute on function public.submit_for_review(uuid) to authenticated;
