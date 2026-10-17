-- =====================================================================
-- 0059 — Campagnes Ads : proposition au client + résultats
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
--
-- Calqué sur la DB Notion de DIMPO que Mariam utilise déjà :
-- une campagne a une période, un objectif, un texte de post, des visuels,
-- un ciblage (âge/loc/centres d'intérêt), un budget — et après diffusion
-- des stats + une analyse + une évaluation.
--
-- Deux statuts, comme ailleurs dans Kreatly :
--   `status`      — Production (`draft` → `approved` → `scheduled` → `live` ; `stopped`
--                   en cas d'arrêt prématuré). Vocabulaire commun aux contenus
--                   (`lib/constants.ts` : approved/scheduled/live partagés), pas
--                   un jeu parallèle. Pas d'équivalent « publié » : une campagne
--                   publicitaire n'a pas d'après — live et puis arrêt.
--   `review_state`— Validation client (`pending_review` / `approved` /
--                   `needs_revision`), même valeurs que `contents` (0052).
--
-- Les visuels, les captures de ciblage et les captures de stats partagent
-- la même table `ad_campaign_media`, distingués par `kind` : trois types
-- de pièces jointes, mêmes RLS, un seul code côté client pour les trois.
-- =====================================================================

create table if not exists public.ad_campaigns (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.brands(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete set null,
  title           text not null,
  theme           text,
  platforms       text[] not null default '{}',
  objective       text,
  post_text       text,
  targeting_age   text,
  targeting_location text,
  targeting_interests text,
  budget_global   text,
  budget_daily    text,
  date_start      date,
  date_end        date,
  status          text not null default 'draft'
                    check (status in ('draft','approved','scheduled','live','stopped')),
  review_state    text
                    check (review_state is null or review_state in ('pending_review','approved','needs_revision')),
  approved_by     uuid references auth.users(id) on delete set null,
  approved_at     timestamptz,
  reach           int,
  clicks          int,
  leads           int,
  emails          int,
  essays          int,
  analysis        text,
  evaluation      text
                    check (evaluation is null or evaluation in ('poor','average','good')),
  live_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ad_campaigns_brand_idx on public.ad_campaigns(brand_id, date_start desc);
create index if not exists ad_campaigns_review_idx on public.ad_campaigns(brand_id, review_state) where review_state = 'pending_review';

-- updated_at
create or replace function public.ad_campaigns_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists ad_campaigns_set_updated_at on public.ad_campaigns;
create trigger ad_campaigns_set_updated_at
  before update on public.ad_campaigns
  for each row execute function public.ad_campaigns_set_updated_at();

-- user_id auto-rempli à l'insert (même pattern que contents)
create or replace function public.ad_campaigns_default_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  return new;
end$$;

drop trigger if exists ad_campaigns_default_user_id on public.ad_campaigns;
create trigger ad_campaigns_default_user_id
  before insert on public.ad_campaigns
  for each row execute function public.ad_campaigns_default_user_id();

alter table public.ad_campaigns enable row level security;

drop policy if exists "ad_campaigns_select" on public.ad_campaigns;
create policy "ad_campaigns_select" on public.ad_campaigns
  for select to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "ad_campaigns_insert" on public.ad_campaigns;
create policy "ad_campaigns_insert" on public.ad_campaigns
  for insert to authenticated
  with check (public.is_brand_writer(brand_id) and user_id = auth.uid());

drop policy if exists "ad_campaigns_update" on public.ad_campaigns;
create policy "ad_campaigns_update" on public.ad_campaigns
  for update to authenticated
  using (public.is_brand_writer(brand_id));

drop policy if exists "ad_campaigns_delete" on public.ad_campaigns;
create policy "ad_campaigns_delete" on public.ad_campaigns
  for delete to authenticated
  using (public.is_brand_writer(brand_id));

-- =====================================================================
-- ad_campaign_media : visuels / captures ciblage / captures stats
-- =====================================================================

create table if not exists public.ad_campaign_media (
  id         uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  kind       text not null check (kind in ('visual','targeting','stats')),
  position   int  not null default 0,
  image_url  text not null,
  caption    text,
  created_at timestamptz not null default now()
);

create index if not exists ad_campaign_media_idx on public.ad_campaign_media(campaign_id, kind, position);

alter table public.ad_campaign_media enable row level security;

drop policy if exists "ad_campaign_media_select" on public.ad_campaign_media;
create policy "ad_campaign_media_select" on public.ad_campaign_media
  for select to authenticated
  using (exists (select 1 from public.ad_campaigns c
                 where c.id = ad_campaign_media.campaign_id
                   and public.is_brand_member(c.brand_id)));

drop policy if exists "ad_campaign_media_insert" on public.ad_campaign_media;
create policy "ad_campaign_media_insert" on public.ad_campaign_media
  for insert to authenticated
  with check (exists (select 1 from public.ad_campaigns c
                      where c.id = ad_campaign_media.campaign_id
                        and public.is_brand_writer(c.brand_id)));

drop policy if exists "ad_campaign_media_update" on public.ad_campaign_media;
create policy "ad_campaign_media_update" on public.ad_campaign_media
  for update to authenticated
  using (exists (select 1 from public.ad_campaigns c
                 where c.id = ad_campaign_media.campaign_id
                   and public.is_brand_writer(c.brand_id)));

drop policy if exists "ad_campaign_media_delete" on public.ad_campaign_media;
create policy "ad_campaign_media_delete" on public.ad_campaign_media
  for delete to authenticated
  using (exists (select 1 from public.ad_campaigns c
                 where c.id = ad_campaign_media.campaign_id
                   and public.is_brand_writer(c.brand_id)));

-- =====================================================================
-- ad_campaign_comments : fil de remarques (équipe + client)
--
-- Même modèle que content_comments mais sur une campagne.
-- Le client (`viewer`) peut commenter, c'est précisément pourquoi il est là.
-- =====================================================================

-- Fil plat volontairement : les campagnes ne portent pas de carrousel
-- (donc pas d'ancre media), et une discussion sur une campagne tient en
-- un fil linéaire. Pas de parent_id, pas de resolved — contents_comments
-- (0009) a ces colonnes parce que son UI s'en sert, pas la nôtre.
create table if not exists public.ad_campaign_comments (
  id         uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists ad_campaign_comments_idx on public.ad_campaign_comments(campaign_id, created_at);

alter table public.ad_campaign_comments enable row level security;

drop policy if exists "ad_campaign_comments_select" on public.ad_campaign_comments;
create policy "ad_campaign_comments_select" on public.ad_campaign_comments
  for select to authenticated
  using (exists (select 1 from public.ad_campaigns c
                 where c.id = ad_campaign_comments.campaign_id
                   and public.is_brand_member(c.brand_id)));

drop policy if exists "ad_campaign_comments_insert" on public.ad_campaign_comments;
create policy "ad_campaign_comments_insert" on public.ad_campaign_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.ad_campaigns c
                where c.id = ad_campaign_comments.campaign_id
                  and public.is_brand_member(c.brand_id))
  );

drop policy if exists "ad_campaign_comments_update" on public.ad_campaign_comments;
create policy "ad_campaign_comments_update" on public.ad_campaign_comments
  for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "ad_campaign_comments_delete" on public.ad_campaign_comments;
create policy "ad_campaign_comments_delete" on public.ad_campaign_comments
  for delete to authenticated
  using (user_id = auth.uid());

-- =====================================================================
-- Soumission au client + validation client (calqué sur 0052)
-- =====================================================================

create or replace function public.submit_ad_campaign_for_review(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_brand_id uuid;
begin
  select brand_id into v_brand_id from public.ad_campaigns where id = p_campaign_id;
  if v_brand_id is null then raise exception 'not_found'; end if;
  if not public.is_brand_writer(v_brand_id) then raise exception 'Forbidden'; end if;

  update public.ad_campaigns
  set review_state = 'pending_review',
      approved_by  = null,
      approved_at  = null
  where id = p_campaign_id;
end$$;

revoke all on function public.submit_ad_campaign_for_review(uuid) from public;
grant execute on function public.submit_ad_campaign_for_review(uuid) to authenticated;

create or replace function public.client_review_ad_campaign(
  p_campaign_id uuid,
  p_decision    text,              -- 'approve' | 'revise'
  p_comment     text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_brand_id uuid;
  v_state    text;
begin
  if p_decision not in ('approve','revise') then raise exception 'Invalid decision'; end if;

  select brand_id, review_state into v_brand_id, v_state
  from public.ad_campaigns where id = p_campaign_id;
  if v_brand_id is null then raise exception 'not_found'; end if;
  if not public.is_brand_member(v_brand_id) then raise exception 'Forbidden'; end if;
  if v_state <> 'pending_review' then raise exception 'not_pending'; end if;

  if p_decision = 'approve' then
    update public.ad_campaigns
    set review_state = 'approved',
        -- Validation client = passage en « Validé » du vocabulaire commun.
        -- Si l'équipe a déjà programmé ou lancé, on ne reculait pas.
        status       = case when status = 'draft' then 'approved' else status end,
        approved_by  = auth.uid(),
        approved_at  = now()
    where id = p_campaign_id;
  else
    update public.ad_campaigns
    set review_state = 'needs_revision',
        approved_by  = null,
        approved_at  = null
    where id = p_campaign_id;
  end if;

  if p_comment is not null and char_length(trim(p_comment)) > 0 then
    insert into public.ad_campaign_comments (campaign_id, user_id, body)
    values (p_campaign_id, auth.uid(), left(trim(p_comment), 2000));
  end if;
end$$;

revoke all on function public.client_review_ad_campaign(uuid, text, text) from public;
grant execute on function public.client_review_ad_campaign(uuid, text, text) to authenticated;

-- =====================================================================
-- Storage : bucket partagé `content-media` réutilisé — path préfixé
-- `ad/{campaign_id}/{uuid}.{ext}` pour ne pas percuter les content_id.
-- Policies calquées sur 0038/0052 : lecture publique (bucket public),
-- écriture réservée aux writers de la marque.
-- =====================================================================

drop policy if exists "ad_media_insert" on storage.objects;
create policy "ad_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'ad'
    and exists (
      select 1 from public.ad_campaigns c
      where c.id::text = (storage.foldername(name))[2]
        and public.is_brand_writer(c.brand_id)
    )
  );

drop policy if exists "ad_media_update" on storage.objects;
create policy "ad_media_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'ad'
    and exists (
      select 1 from public.ad_campaigns c
      where c.id::text = (storage.foldername(name))[2]
        and public.is_brand_writer(c.brand_id)
    )
  );

drop policy if exists "ad_media_delete" on storage.objects;
create policy "ad_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'ad'
    and exists (
      select 1 from public.ad_campaigns c
      where c.id::text = (storage.foldername(name))[2]
        and public.is_brand_writer(c.brand_id)
    )
  );
