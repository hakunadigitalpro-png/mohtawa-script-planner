-- Partager une campagne publicitaire par lien, avec n'importe qui, sans compte :
-- même principe que le partage d'un contenu (0005). Le lien montre la
-- proposition (période, objectif, plateformes, texte, budget, ciblage), les
-- annonces avec leurs visuels et textes, et les résultats s'il y en a.
-- Jamais : les remarques, l'historique, le responsable, l'état de validation.
--
-- Ajouts uniquement.

alter table public.ad_campaigns
  add column if not exists share_token text;

create unique index if not exists ad_campaigns_share_token_idx
  on public.ad_campaigns (share_token)
  where share_token is not null;

-- Crée ou renouvelle le lien. Renouveler coupe l'ancien.
create or replace function public.enable_ad_campaign_sharing(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_brand uuid;
  v_token text;
begin
  select brand_id into v_brand from public.ad_campaigns where id = p_campaign_id;
  if v_brand is null then raise exception 'not_found'; end if;
  if not public.is_brand_writer(v_brand) then raise exception 'Forbidden'; end if;

  v_token := encode(gen_random_bytes(18), 'base64');
  -- base64 adapté aux adresses : +, / et = n'ont rien à faire dans un lien.
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  update public.ad_campaigns set share_token = v_token where id = p_campaign_id;
  return v_token;
end$$;

revoke all on function public.enable_ad_campaign_sharing(uuid) from public;
grant execute on function public.enable_ad_campaign_sharing(uuid) to authenticated;

create or replace function public.disable_ad_campaign_sharing(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand uuid;
begin
  select brand_id into v_brand from public.ad_campaigns where id = p_campaign_id;
  if v_brand is null then raise exception 'not_found'; end if;
  if not public.is_brand_writer(v_brand) then raise exception 'Forbidden'; end if;
  update public.ad_campaigns set share_token = null where id = p_campaign_id;
end$$;

revoke all on function public.disable_ad_campaign_sharing(uuid) from public;
grant execute on function public.disable_ad_campaign_sharing(uuid) to authenticated;

-- Lecture publique par le lien. Le jeton n'est pas renvoyé : la page n'en a pas
-- besoin et il n'a rien à faire dans ce qu'on montre.
create or replace function public.get_shared_ad_campaign(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.ad_campaigns;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;

  select * into c from public.ad_campaigns where share_token = p_token;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'brand', (select b.name from public.brands b where b.id = c.brand_id),
    'title', c.title,
    'theme', c.theme,
    'platforms', to_jsonb(c.platforms),
    'objective', c.objective,
    'post_text', c.post_text,
    'budget_global', c.budget_global,
    'budget_daily', c.budget_daily,
    'date_start', c.date_start,
    'date_end', c.date_end,
    'status', c.status,
    'targeting_age', c.targeting_age,
    'targeting_location', c.targeting_location,
    'targeting_interests', c.targeting_interests,
    'reach', c.reach,
    'clicks', c.clicks,
    'leads', c.leads,
    'emails', c.emails,
    'essays', c.essays,
    'analysis', c.analysis,
    'live_url', c.live_url,
    -- Les visuels d'avant les annonces (0059), pour les anciennes campagnes.
    'visuals', coalesce((
      select jsonb_agg(m.image_url order by m.position)
      from public.ad_campaign_media m
      where m.campaign_id = c.id and m.kind = 'visual'
    ), '[]'::jsonb),
    'ad_sets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', s.name,
          'targeting_age', s.targeting_age,
          'targeting_location', s.targeting_location,
          'targeting_interests', s.targeting_interests,
          'budget_daily', s.budget_daily,
          'ads', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'name', a.name,
                'hook', a.hook,
                'visual_url', a.visual_url,
                'video_url', a.video_url,
                'slides', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'visual_url', sl.visual_url,
                      'video_url', sl.video_url,
                      'text', sl.text
                    ) order by sl.position
                  )
                  from public.ad_slides sl
                  where sl.ad_id = a.id
                ), '[]'::jsonb)
              ) order by a.position
            )
            from public.ads a
            where a.ad_set_id = s.id
          ), '[]'::jsonb)
        ) order by s.position
      )
      from public.ad_sets s
      where s.campaign_id = c.id
    ), '[]'::jsonb)
  );
end$$;

revoke all on function public.get_shared_ad_campaign(text) from public;
grant execute on function public.get_shared_ad_campaign(text) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
