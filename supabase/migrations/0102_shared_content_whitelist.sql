-- =====================================================================
-- 0102 — Le lien public : tout le contenu, et rien que le contenu
-- Idempotent. Reprise de 0036, deux changements :
--
--   1. Liste blanche (même choix que 0099 pour les campagnes). `to_jsonb(c.*)`
--      envoyait au navigateur de l'invité les notes d'idée, l'échéance, le
--      responsable, le premier commentaire ; `to_jsonb(p.*)` la transcription,
--      l'autopsie IA et les captures d'insights ; `to_jsonb(sc.*)` les notes
--      de montage. Rien de tout ça n'était affiché, tout était lisible.
--   2. Ce qui manquait : la voix off d'un vlog, les visuels, la légende, les
--      parties d'un contenu long, le lien de la vidéo prête.
--
-- Jamais exposés : la transcription (kind = 'transcript'), l'origine d'un
-- extrait, `first_comment`.
-- =====================================================================

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

  -- La vidéo est prête et l'équipe a masqué la production : pas de storyboard.
  -- Le script reste, comme sur l'écran de validation.
  v_hide_production :=
    coalesce(c.hide_production_tabs, false) and coalesce(trim(c.preview_url), '') <> '';

  return jsonb_build_object(
    'content', jsonb_build_object(
      'id', c.id,
      'type', c.type,
      'title', c.title,
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
        jsonb_build_object('id', x.id, 'title', x.title, 'body', x.body, 'minutes', x.minutes)
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
