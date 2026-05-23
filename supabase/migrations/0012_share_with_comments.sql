-- 0012_share_with_comments.sql
-- Extends the public-share feature so the creator can authorize guests to
-- leave comments (not just read). Use case: a creator shares a draft Reel
-- with a client. The client wants to leave block-level feedback.
--
-- Design choices :
--  - Guests identify with a Name (required) + Email (optional). Stored in
--    new columns on content_comments. user_id is now nullable.
--  - Guests can ADD + REPLY only. No editing / deleting / resolving.
--  - All security goes through SECURITY DEFINER RPCs that validate the
--    share token + mode. No RLS changes needed (the helper RPCs bypass it).

-- ============================ Share mode ============================
alter table public.contents
  add column if not exists share_mode text not null default 'read'
  check (share_mode in ('read', 'comment'));

-- ============================ Guest fields ============================
-- Make user_id nullable so guest comments can exist without an auth user.
alter table public.content_comments
  alter column user_id drop not null;

alter table public.content_comments
  add column if not exists guest_name text,
  add column if not exists guest_email text;

-- Either user_id OR a non-empty guest_name must be set — never both null.
-- We drop first in case the constraint already exists from a previous attempt.
alter table public.content_comments
  drop constraint if exists content_comments_author_check;
alter table public.content_comments
  add constraint content_comments_author_check
  check (
    (user_id is not null)
    or (guest_name is not null and length(trim(guest_name)) > 0)
  );

-- ============================ update_share_mode ============================
-- Allows brand members to switch between 'read' and 'comment' on a content.
-- Used by the ShareButton dialog toggle.
create or replace function public.update_share_mode(
  p_content_id uuid,
  p_mode text
)
returns void
language plpgsql
security invoker
as $$
begin
  if p_mode not in ('read', 'comment') then
    raise exception 'invalid share mode: %', p_mode;
  end if;

  -- RLS check : seul un membre de la marque peut changer le mode
  update public.contents
  set share_mode = p_mode
  where id = p_content_id
    and public.is_brand_member(brand_id);

  if not found then
    raise exception 'not authorized or content not found';
  end if;
end;
$$;

revoke all on function public.update_share_mode(uuid, text) from public;
grant execute on function public.update_share_mode(uuid, text) to authenticated;

-- ============================ add_guest_comment ============================
-- Public RPC for anonymous visitors to leave a comment via the share token.
-- Validates : (1) token exists, (2) share_mode = 'comment', (3) target valid.
-- Inserts with user_id=null, guest_name, guest_email.
create or replace function public.add_guest_comment(
  p_token text,
  p_target_type text,
  p_target_id text,
  p_parent_id uuid,
  p_body text,
  p_guest_name text,
  p_guest_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content_id uuid;
  v_share_mode text;
  v_new_id uuid;
begin
  -- 1. Validate token + grab the matching content (no auth needed)
  select id, share_mode into v_content_id, v_share_mode
  from public.contents
  where share_token = p_token
  limit 1;

  if v_content_id is null then
    raise exception 'invalid_token';
  end if;

  if v_share_mode <> 'comment' then
    raise exception 'comments_not_allowed';
  end if;

  -- 2. Validate body and guest_name
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'empty_body';
  end if;

  if p_guest_name is null or length(trim(p_guest_name)) = 0 then
    raise exception 'guest_name_required';
  end if;

  -- 3. Validate target_type matches the existing schema
  if p_target_type not in ('plan', 'script', 'scene', 'slide') then
    raise exception 'invalid_target_type';
  end if;

  -- 4. If reply, validate the parent exists on the same content
  if p_parent_id is not null then
    if not exists (
      select 1 from public.content_comments
      where id = p_parent_id and content_id = v_content_id
    ) then
      raise exception 'invalid_parent';
    end if;
  end if;

  -- 5. Insert (bypasses RLS thanks to SECURITY DEFINER)
  insert into public.content_comments (
    content_id,
    target_type,
    target_id,
    parent_id,
    user_id,
    guest_name,
    guest_email,
    body
  )
  values (
    v_content_id,
    p_target_type,
    p_target_id,
    p_parent_id,
    null,
    trim(p_guest_name),
    nullif(trim(p_guest_email), ''),
    trim(p_body)
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.add_guest_comment(text, text, text, uuid, text, text, text) from public;
grant execute on function public.add_guest_comment(text, text, text, uuid, text, text, text) to anon, authenticated;

-- ============================ list_content_comments_with_authors (UPDATE) ============================
-- Extend the existing team-side comments RPC to also return guest fields.
-- This way the inbox drawer on /content/[id] sees both team + guest comments
-- with the right author info ("Ali · Invité" vs "ali@team.com").
--
-- IMPORTANT : on DROP d'abord la fonction existante (créée en 0009) parce que
-- Postgres refuse CREATE OR REPLACE quand la signature de retour change (on
-- ajoute 3 colonnes : guest_name, guest_email, is_guest).
drop function if exists public.list_content_comments_with_authors(uuid);

create or replace function public.list_content_comments_with_authors(
  p_content_id uuid
)
returns table (
  id           uuid,
  content_id   uuid,
  target_type  text,
  target_id    text,
  parent_id    uuid,
  user_id      uuid,
  author_email text,
  guest_name   text,
  guest_email  text,
  is_guest     boolean,
  body         text,
  resolved     boolean,
  created_at   timestamptz,
  updated_at   timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  -- Only brand members can see team-side comments listing
  if not public.is_brand_member(
    (select brand_id from public.contents where id = p_content_id)
  ) then
    return;
  end if;

  return query
  select
    c.id,
    c.content_id,
    c.target_type,
    c.target_id,
    c.parent_id,
    c.user_id,
    u.email::text as author_email,
    c.guest_name,
    c.guest_email,
    (c.user_id is null) as is_guest,
    c.body,
    c.resolved,
    c.created_at,
    c.updated_at
  from public.content_comments c
  left join auth.users u on u.id = c.user_id
  where c.content_id = p_content_id
  order by c.created_at asc;
end;
$$;

revoke all on function public.list_content_comments_with_authors(uuid) from public;
grant execute on function public.list_content_comments_with_authors(uuid) to authenticated;

-- ============================ get_shared_content (UPDATE) ============================
-- Extend the public share RPC to also return :
--   - share_mode (so the share page knows whether to show comment UI)
--   - comments (anonymized : no team author emails leak to the public)
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
    'performance', (select to_jsonb(p.*) from public.performances p where p.content_id = v_content_id),
    -- Anonymized comments : pas d'email d'auteur (privacy).
    -- Pour les commentaires d'équipe : on retourne juste un author_label = "Équipe".
    -- Pour les commentaires invités : on retourne le guest_name (mais pas l'email).
    'comments',    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', cc.id,
            'target_type', cc.target_type,
            'target_id', cc.target_id,
            'parent_id', cc.parent_id,
            'body', cc.body,
            'resolved', cc.resolved,
            'is_guest', (cc.user_id is null),
            'guest_name', cc.guest_name,
            'created_at', cc.created_at
          )
          order by cc.created_at asc
        ),
        '[]'::jsonb
      )
      from public.content_comments cc
      where cc.content_id = v_content_id
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_shared_content(text) from public;
grant execute on function public.get_shared_content(text) to anon, authenticated;
