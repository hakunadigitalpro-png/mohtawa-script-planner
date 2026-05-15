-- =====================================================================
-- 0005 — Partage par lien public + réorganisation drag&drop
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

-- 1) contents.share_token ----------------------------------------------
alter table public.contents
  add column if not exists share_token text unique;

create index if not exists contents_share_token_idx
  on public.contents(share_token)
  where share_token is not null;

-- 2) RPC partage : activer / désactiver / rotation --------------------
create or replace function public.enable_content_sharing(p_content_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  v_token text;
begin
  v_token := encode(gen_random_bytes(18), 'base64');
  -- base64 url-safe : on remplace +,/,= par -, _, '' pour des liens propres.
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  update public.contents
  set share_token = v_token
  where id = p_content_id
  returning share_token into v_token;

  return v_token;
end$$;

revoke all on function public.enable_content_sharing(uuid) from public;
grant execute on function public.enable_content_sharing(uuid) to authenticated;

create or replace function public.disable_content_sharing(p_content_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update public.contents
  set share_token = null
  where id = p_content_id;
end$$;

revoke all on function public.disable_content_sharing(uuid) from public;
grant execute on function public.disable_content_sharing(uuid) to authenticated;

-- 3) RPC publique : lire le bundle partagé (security definer)
--    Anyone with the token gets the data, no auth required.
create or replace function public.get_shared_content(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_content_id uuid;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 10 then
    return null;
  end if;

  select id into v_content_id
  from public.contents
  where share_token = p_token
  limit 1;

  if v_content_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'content',     (select to_jsonb(c.*) - 'share_token' from public.contents c where c.id = v_content_id),
    'brand_name',  (select b.name from public.brands b
                    join public.contents c on c.brand_id = b.id
                    where c.id = v_content_id),
    'reel',        (select to_jsonb(r.*) from public.reel_details r where r.content_id = v_content_id),
    'story',       (select to_jsonb(s.*) from public.story_details s where s.content_id = v_content_id),
    'slides',      (select coalesce(jsonb_agg(to_jsonb(sl.*) order by sl.slot_number), '[]'::jsonb)
                    from public.story_slides sl where sl.content_id = v_content_id),
    'scenes',      (select coalesce(jsonb_agg(to_jsonb(sc.*) order by sc.scene_number), '[]'::jsonb)
                    from public.storyboard_scenes sc where sc.content_id = v_content_id),
    'performance', (select to_jsonb(p.*) from public.performances p where p.content_id = v_content_id)
  ) into v_result;

  return v_result;
end$$;

revoke all on function public.get_shared_content(text) from public;
grant execute on function public.get_shared_content(text) to anon, authenticated;

-- 4) Réorganisation atomique des scènes storyboard --------------------
-- Reçoit un array d'UUIDs dans le nouvel ordre ; renumérote 1..N.
create or replace function public.reorder_storyboard_scenes(
  p_content_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
as $$
declare
  i int;
begin
  -- Étape 1 : décaler temporairement pour éviter le conflit UNIQUE
  update public.storyboard_scenes
  set scene_number = scene_number + 10000
  where content_id = p_content_id;

  -- Étape 2 : assigner les nouveaux numéros dans l'ordre demandé
  for i in 1..array_length(p_ordered_ids, 1) loop
    update public.storyboard_scenes
    set scene_number = i
    where id = p_ordered_ids[i] and content_id = p_content_id;
  end loop;
end$$;

revoke all on function public.reorder_storyboard_scenes(uuid, uuid[]) from public;
grant execute on function public.reorder_storyboard_scenes(uuid, uuid[]) to authenticated;

-- 5) Échange de contenu entre 2 slots de story -------------------------
-- Les labels (slot 1 = intro, slot 5 = CTA) restent fixes ; on échange
-- juste le body et l'image_url entre les deux slots demandés.
create or replace function public.swap_story_slides(
  p_content_id uuid,
  p_slot_a int,
  p_slot_b int
)
returns void
language plpgsql
security invoker
as $$
declare
  rec_a record;
  rec_b record;
begin
  if p_slot_a = p_slot_b then return; end if;

  select body, image_url into rec_a
  from public.story_slides
  where content_id = p_content_id and slot_number = p_slot_a;

  select body, image_url into rec_b
  from public.story_slides
  where content_id = p_content_id and slot_number = p_slot_b;

  -- Upsert au cas où un slot serait vide (pas encore créé en DB)
  insert into public.story_slides (content_id, slot_number, body, image_url)
  values (p_content_id, p_slot_a, rec_b.body, rec_b.image_url)
  on conflict (content_id, slot_number)
  do update set body = excluded.body, image_url = excluded.image_url;

  insert into public.story_slides (content_id, slot_number, body, image_url)
  values (p_content_id, p_slot_b, rec_a.body, rec_a.image_url)
  on conflict (content_id, slot_number)
  do update set body = excluded.body, image_url = excluded.image_url;
end$$;

revoke all on function public.swap_story_slides(uuid, int, int) from public;
grant execute on function public.swap_story_slides(uuid, int, int) to authenticated;
