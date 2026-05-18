-- 0010_scene_slot_filmed.sql
-- Adds a per-scene / per-slot "filmed" flag so creators can track granular
-- shooting progress (e.g. one scene per day) instead of relying on a single
-- macro boolean in reel_details.checklist.

-- ============================ Storyboard scenes ============================
alter table public.storyboard_scenes
  add column if not exists filmed boolean not null default false;

-- ============================ Story slides ============================
alter table public.story_slides
  add column if not exists filmed boolean not null default false;

-- ============================ Swap function (update) ============================
-- The swap_story_slides RPC must also swap the `filmed` flag so the
-- "filmed" status follows the content of the slot (not the slot number).
-- Example: slot 1 is filmed, user drags slot 1 → slot 3. After swap,
-- slot 3 should now show "filmed" (the content moved with its filmed state).
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

  select body, image_url, filmed into rec_a
  from public.story_slides
  where content_id = p_content_id and slot_number = p_slot_a;

  select body, image_url, filmed into rec_b
  from public.story_slides
  where content_id = p_content_id and slot_number = p_slot_b;

  -- Upsert au cas où un slot serait vide (pas encore créé en DB).
  -- coalesce(filmed, false) gère le cas où le slot source n'existait pas.
  insert into public.story_slides (content_id, slot_number, body, image_url, filmed)
  values (
    p_content_id,
    p_slot_a,
    rec_b.body,
    rec_b.image_url,
    coalesce(rec_b.filmed, false)
  )
  on conflict (content_id, slot_number)
  do update set
    body = excluded.body,
    image_url = excluded.image_url,
    filmed = excluded.filmed;

  insert into public.story_slides (content_id, slot_number, body, image_url, filmed)
  values (
    p_content_id,
    p_slot_b,
    rec_a.body,
    rec_a.image_url,
    coalesce(rec_a.filmed, false)
  )
  on conflict (content_id, slot_number)
  do update set
    body = excluded.body,
    image_url = excluded.image_url,
    filmed = excluded.filmed;
end$$;

-- Re-grant (idempotent — revoke first to avoid duplicate grants on re-run)
revoke all on function public.swap_story_slides(uuid, int, int) from public;
grant execute on function public.swap_story_slides(uuid, int, int) to authenticated;
