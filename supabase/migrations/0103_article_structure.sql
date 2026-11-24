-- =====================================================================
-- 0103 — Un article a une structure : sous-titre, introduction, conclusion
-- Idempotent. Aucune donnée existante n'est modifiée (role et subtitle
-- restent vides : un article déjà écrit se relit comme avant).
--
-- `role` : 'intro' (sans intertitre ni numéro), 'item' (numéroté, parce que le
-- titre l'annonce), 'text' (non numéroté), 'outro'. Null pour les autres formats.
-- Le numéro est CALCULÉ à l'affichage, jamais écrit dans le titre.
-- =====================================================================

alter table public.content_sections
  add column if not exists role text;

alter table public.content_sections
  drop constraint if exists content_sections_role_check;
alter table public.content_sections
  add constraint content_sections_role_check
  check (role is null or role in ('intro', 'item', 'text', 'outro'));

alter table public.contents
  add column if not exists subtitle text;

alter table public.contents
  drop constraint if exists contents_subtitle_check;
alter table public.contents
  add constraint contents_subtitle_check
  check (subtitle is null or char_length(subtitle) <= 300);

-- ---------------------------------------------------------------------
-- Enregistrer les parties : reprise de 0101, avec le rôle. Absent de l'envoi
-- (ancienne version de l'écran encore ouverte), le rôle en base est gardé.
-- ---------------------------------------------------------------------
create or replace function public.save_content_sections(
  p_content_id uuid,
  p_sections   jsonb,
  p_order      uuid[],
  p_deleted    uuid[] default '{}'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.contents c
    where c.id = p_content_id and public.is_brand_writer(c.brand_id)
  ) then
    raise exception 'not_authorized';
  end if;

  if jsonb_typeof(p_sections) <> 'array'
     or jsonb_array_length(p_sections) > 60
     or coalesce(cardinality(p_order), 0) > 60 then
    raise exception 'too_many_sections';
  end if;

  -- L'écran modifie une partie qui n'existe plus : l'article a été remplacé
  -- ailleurs. La réinsérer la glisserait au milieu du nouveau texte.
  if exists (
    select 1 from jsonb_array_elements(p_sections) as s(value)
    where (s.value ->> 'existing')::boolean is true
      and not exists (
        select 1 from public.content_sections x
        where x.id = (s.value ->> 'id')::uuid and x.content_id = p_content_id
      )
  ) then
    raise exception 'stale_sections';
  end if;

  delete from public.content_sections
  where content_id = p_content_id
    and kind = 'section'
    and id = any(coalesce(p_deleted, '{}'));

  insert into public.content_sections
    (id, content_id, kind, position, title, body, minutes, role)
  select
    (s.value ->> 'id')::uuid,
    p_content_id,
    'section',
    coalesce(array_position(p_order, (s.value ->> 'id')::uuid) - 1, 0),
    nullif(trim(s.value ->> 'title'), ''),
    nullif(s.value ->> 'body', ''),
    (s.value ->> 'minutes')::smallint,
    s.value ->> 'role'
  from jsonb_array_elements(p_sections) as s(value)
  on conflict (id) do update
    set title    = excluded.title,
        body     = excluded.body,
        minutes  = excluded.minutes,
        role     = coalesce(excluded.role, content_sections.role)
    where content_sections.content_id = excluded.content_id
      and content_sections.kind = 'section';

  update public.content_sections x
  set position = array_position(p_order, x.id) - 1
  where x.content_id = p_content_id
    and x.kind = 'section'
    and x.id = any(p_order)
    and x.position is distinct from array_position(p_order, x.id) - 1;
end$$;

revoke all on function public.save_content_sections(uuid, jsonb, uuid[], uuid[]) from public;
grant execute on function public.save_content_sections(uuid, jsonb, uuid[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Passage en ligne : reprise de 0100. Un article qui porte encore un
-- « [À CONFIRMER] » ne sort pas tout seul, même programmé AVANT qu'on l'y
-- ajoute. Son statut ne change pas : l'éditeur le signale.
-- ---------------------------------------------------------------------
create or replace function public.recompute_live_statuses(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Classes explicites : `lower` et `~*` ignorent les accents selon la locale.
  v_mark constant text := '\[\s*[aAàÀ]\s+confirmer';
begin
  if not public.is_brand_member(p_brand_id) then
    raise exception 'not_authorized';
  end if;

  perform set_config('kreatly.system_change', '1', true);

  update public.contents c
  set status = 'live'
  where c.brand_id = p_brand_id
    and c.status in ('programmed', 'scheduled')
    and c.type is not null
    and exists (
      select 1 from public.content_publications p
      where p.content_id = c.id
        and p.scheduled_date is not null
        and (p.scheduled_date::timestamp + coalesce(p.scheduled_time, '00:00'::time)) <= now()
    )
    and not (
      c.type = 'article'
      and (
        lower(normalize(coalesce(c.title, '') || ' ' || coalesce(c.subtitle, '') || ' ' || coalesce(c.caption, ''), NFC)) ~ v_mark
        or exists (
          select 1 from public.content_sections s
          where s.content_id = c.id
            and s.kind = 'section'
            and lower(normalize(coalesce(s.title, '') || ' ' || coalesce(s.body, ''), NFC)) ~ v_mark
        )
      )
    );

  perform set_config('kreatly.system_change', '', true);
end$$;

revoke all on function public.recompute_live_statuses(uuid) from public;
grant execute on function public.recompute_live_statuses(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Lien public : reprise de 0102, avec le sous-titre et le rôle des parties.
-- Rien d'autre ne s'ajoute à la liste blanche.
-- ---------------------------------------------------------------------
create or replace function public.get_shared_content(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.contents;
  v_hide_production boolean;
begin
  if p_token is null or length(p_token) < 10 then
    return null;
  end if;

  select * into c from public.contents where share_token = p_token limit 1;
  if not found then
    return null;
  end if;

  v_hide_production :=
    coalesce(c.hide_production_tabs, false) and coalesce(trim(c.preview_url), '') <> '';

  return jsonb_build_object(
    'content', jsonb_build_object(
      'id', c.id,
      'type', c.type,
      'title', c.title,
      'subtitle', c.subtitle,
      'date', c.date,
      'platform', c.platform,
      'status', c.status,
      'pillar', c.pillar,
      'objective', c.objective,
      'hook', c.hook,
      'cta', c.cta,
      'caption', c.caption,
      'preview_url', c.preview_url,
      'share_mode', c.share_mode
    ),
    'brand_name', (select b.name from public.brands b where b.id = c.brand_id),
    'reel', (
      select jsonb_build_object(
        'intro', r.intro, 'point1', r.point1, 'point2', r.point2,
        'point3', r.point3, 'transition', r.transition, 'recap', r.recap,
        'outro', r.outro, 'script_full', r.script_full
      )
      from public.reel_details r where r.content_id = c.id
    ),
    'vlog', (
      select jsonb_build_object(
        'angle', v.angle, 'hook', v.hook,
        'arc_situation', v.arc_situation,
        'arc_development', v.arc_development,
        'arc_payoff', v.arc_payoff,
        'voiceover', v.voiceover
      )
      from public.vlog_details v where v.content_id = c.id
    ),
    'story', (
      select jsonb_build_object('objective', s.objective, 'cta_soft', s.cta_soft)
      from public.story_details s where s.content_id = c.id
    ),
    'slides', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sl.id, 'slot_number', sl.slot_number,
          'body', sl.body, 'image_url', sl.image_url
        ) order by sl.slot_number
      )
      from public.story_slides sl where sl.content_id = c.id
    ), '[]'::jsonb),
    'scenes', case when v_hide_production then '[]'::jsonb else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sc.id, 'scene_number', sc.scene_number,
          'description', sc.description, 'camera_angle', sc.camera_angle,
          'on_screen_text', sc.on_screen_text, 'image_url', sc.image_url
        ) order by sc.scene_number
      )
      from public.storyboard_scenes sc where sc.content_id = c.id
    ), '[]'::jsonb) end,
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', m.id, 'image_url', m.image_url) order by m.position
      )
      from public.content_media m
      where m.content_id = c.id and m.image_url is not null
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id, 'title', x.title, 'body', x.body,
          'minutes', x.minutes, 'role', x.role
        )
        order by x.position
      )
      from public.content_sections x
      where x.content_id = c.id and x.kind = 'section'
    ), '[]'::jsonb),
    'guest', (
      select jsonb_build_object('title', g.title, 'body', g.body)
      from public.content_sections g
      where g.content_id = c.id and g.kind = 'guest'
    ),
    'performance', (
      select jsonb_build_object(
        'views', p.views, 'likes', p.likes, 'comments', p.comments,
        'shares', p.shares, 'saves', p.saves, 'retention', p.retention,
        'notes', p.notes
      )
      from public.performances p where p.content_id = c.id
    ),
    -- Uniquement les commentaires INVITÉS (user_id is null) : les discussions
    -- internes de l'équipe ne sortent pas par le lien public (0036).
    'comments', coalesce((
      select jsonb_agg(
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
        ) order by cc.created_at asc
      )
      from public.content_comments cc
      where cc.content_id = c.id and cc.user_id is null
    ), '[]'::jsonb)
  );
end$$;

revoke all on function public.get_shared_content(text) from public;
grant execute on function public.get_shared_content(text) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
