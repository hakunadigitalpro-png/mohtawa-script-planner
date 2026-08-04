-- =====================================================================
-- 0036 — Durcissement sécurité des commentaires (audit #14 + #18)
--
-- #14 : la policy UPDATE de content_comments autorisait TOUT membre à éditer
--       N'IMPORTE QUEL commentaire (pas seulement le sien). On restreint
--       l'édition à l'auteur ; le toggle "résolu" (que tout membre doit
--       pouvoir faire) passe par une fonction dédiée qui ne touche QUE la
--       colonne resolved.
--
-- #18 : (a) get_shared_content renvoyait TOUS les commentaires sur le lien
--       public, y compris les discussions INTERNES de l'équipe → on ne
--       renvoie plus que les commentaires INVITÉS (user_id is null).
--       (b) add_guest_comment n'avait aucun anti-abus → plafond glissant.
--
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

-- ============================ #14 ============================
-- Édition d'un commentaire : uniquement l'auteur.
drop policy if exists "comments_update_members" on public.content_comments;
drop policy if exists "comments_update_author" on public.content_comments;
create policy "comments_update_author" on public.content_comments
  for update to authenticated
  using (user_id = auth.uid());

-- Toggle "résolu" par n'importe quel membre de la marque (ne touche que
-- la colonne resolved). SECURITY DEFINER car la policy UPDATE ci-dessus ne
-- laisse plus passer un non-auteur.
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
begin
  select content_id into v_content_id
  from public.content_comments
  where id = p_comment_id;

  if v_content_id is null then
    raise exception 'not_found';
  end if;

  if not exists (
    select 1 from public.contents c
    where c.id = v_content_id
      and public.is_brand_member(c.brand_id)
  ) then
    raise exception 'Forbidden';
  end if;

  update public.content_comments
  set resolved = p_resolved
  where id = p_comment_id;
end$$;

revoke all on function public.set_comment_resolved(uuid, boolean) from public;
grant execute on function public.set_comment_resolved(uuid, boolean) to authenticated;

-- ============================ #18a ============================
-- get_shared_content : ne renvoyer QUE les commentaires invités (user_id is
-- null) sur le lien public — plus de fuite des discussions internes d'équipe.
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
    -- Uniquement les commentaires INVITÉS (user_id is null) : les discussions
    -- internes de l'équipe ne fuitent plus sur le lien public.
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
            'is_guest', true,
            'guest_name', cc.guest_name,
            'created_at', cc.created_at
          )
          order by cc.created_at asc
        ),
        '[]'::jsonb
      )
      from public.content_comments cc
      where cc.content_id = v_content_id
        and cc.user_id is null
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_shared_content(text) from public;
grant execute on function public.get_shared_content(text) to anon, authenticated;

-- ============================ #18b ============================
-- add_guest_comment : anti-abus (plafond glissant de commentaires invités par
-- contenu). Identique à 0012 + une vérif de débit avant l'insert.
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
  -- 1. Token + contenu
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

  -- 2. Body + nom invité
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'empty_body';
  end if;

  if p_guest_name is null or length(trim(p_guest_name)) = 0 then
    raise exception 'guest_name_required';
  end if;

  -- 3. target_type valide
  if p_target_type not in ('plan', 'script', 'scene', 'slide') then
    raise exception 'invalid_target_type';
  end if;

  -- 4. Si réponse, parent valide sur le même contenu
  if p_parent_id is not null then
    if not exists (
      select 1 from public.content_comments
      where id = p_parent_id and content_id = v_content_id
    ) then
      raise exception 'invalid_parent';
    end if;
  end if;

  -- 5. Anti-abus : plafond de 20 commentaires invités / 10 min / contenu.
  if (
    select count(*) from public.content_comments
    where content_id = v_content_id
      and user_id is null
      and created_at > now() - interval '10 minutes'
  ) >= 20 then
    raise exception 'rate_limited';
  end if;

  -- 6. Insert (bypasse la RLS via SECURITY DEFINER)
  insert into public.content_comments (
    content_id, target_type, target_id, parent_id,
    user_id, guest_name, guest_email, body
  )
  values (
    v_content_id, p_target_type, p_target_id, p_parent_id,
    null, trim(p_guest_name), nullif(trim(p_guest_email), ''), trim(p_body)
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.add_guest_comment(text, text, text, uuid, text, text, text) from public;
grant execute on function public.add_guest_comment(text, text, text, uuid, text, text, text) to anon, authenticated;
