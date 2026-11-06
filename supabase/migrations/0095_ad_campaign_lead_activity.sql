-- Publicités, repris de la table Campaigns d'Airtable (testée le 06/11/2026) :
--   - un RESPONSABLE par campagne, parmi l'équipe de la marque ;
--   - un HISTORIQUE par campagne : qui a changé quoi, qui a validé ;
--   - le statut suit les DATES. `lib/types-ads.ts` l'annonçait depuis la
--     disparition de « Programmée » du menu, mais rien ne le faisait : une
--     campagne finie restait « En cours » tant qu'on n'y touchait pas.
--
-- Ajouts uniquement. Le premier affichage après cette migration peut déplacer
-- des campagnes selon leurs dates : c'est le comportement voulu.

alter table public.ad_campaigns
  add column if not exists lead_id uuid references auth.users(id) on delete set null;

create index if not exists ad_campaigns_lead_idx
  on public.ad_campaigns (lead_id)
  where lead_id is not null;

-- Le responsable fait partie de l'équipe de CETTE marque.
create or replace function public.ad_campaigns_check_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_id is not null
     and (tg_op = 'INSERT' or new.lead_id is distinct from old.lead_id)
     and not exists (
       select 1 from public.brand_members m
       where m.brand_id = new.brand_id
         and m.user_id = new.lead_id
         and m.role <> 'viewer'
     )
  then
    raise exception 'lead_not_member';
  end if;
  return new;
end$$;

drop trigger if exists ad_campaigns_check_lead_trg on public.ad_campaigns;
create trigger ad_campaigns_check_lead_trg
  before insert or update of lead_id on public.ad_campaigns
  for each row execute function public.ad_campaigns_check_lead();

-- Quelqu'un quitte la marque : ni ses contenus ni ses campagnes ne gardent un
-- responsable que plus personne ne peut joindre. Reprise de 0094 + campagnes.
create or replace function public.brand_members_clear_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contents
  set assignee_id = null
  where brand_id = old.brand_id
    and assignee_id = old.user_id;

  update public.ad_campaigns
  set lead_id = null
  where brand_id = old.brand_id
    and lead_id = old.user_id;

  return null;
end$$;

-- =====================================================================
-- Historique. Écrit par le trigger, lu par la RPC, réservé à l'équipe.
-- =====================================================================
create table if not exists public.ad_campaign_activity (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  -- Null : c'est Kreatly (passage automatique selon les dates).
  actor_id    uuid,
  field       text not null check (
    field in ('status', 'review', 'dates', 'title', 'budget', 'lead')
  ),
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index if not exists ad_campaign_activity_idx
  on public.ad_campaign_activity (campaign_id, created_at desc);

alter table public.ad_campaign_activity enable row level security;

create or replace function public.log_ad_campaign_activity(
  p_campaign uuid,
  p_field    text,
  p_old      text,
  p_new      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system boolean := coalesce(current_setting('kreatly.system_change', true), '') = '1';
  v_actor  uuid := case when v_system then null else auth.uid() end;
  v_last   record;
begin
  if v_actor is null and not v_system then
    return;
  end if;

  -- Le titre s'enregistre à la sortie du champ et le budget se recalcule tout
  -- seul : dix minutes de réglages font une ligne, pas dix.
  if p_field in ('title', 'budget', 'dates') then
    select a.id, a.old_value into v_last
    from public.ad_campaign_activity a
    where a.campaign_id = p_campaign
      and a.field = p_field
      and a.actor_id is not distinct from v_actor
      and a.created_at > now() - interval '10 minutes'
    order by a.created_at desc
    limit 1;

    if found then
      if p_new is not null and v_last.old_value is not distinct from p_new then
        delete from public.ad_campaign_activity where id = v_last.id;
      else
        update public.ad_campaign_activity
        set new_value = p_new, created_at = now()
        where id = v_last.id;
      end if;
      return;
    end if;
  end if;

  insert into public.ad_campaign_activity (campaign_id, actor_id, field, old_value, new_value)
  values (p_campaign, v_actor, p_field, p_old, p_new);
end$$;

revoke all on function public.log_ad_campaign_activity(uuid, text, text, text)
  from public, anon, authenticated;

create or replace function public.ad_campaigns_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_dates text := concat_ws(' → ', old.date_start::text, old.date_end::text);
  v_new_dates text := concat_ws(' → ', new.date_start::text, new.date_end::text);
begin
  if new.status is distinct from old.status then
    perform public.log_ad_campaign_activity(new.id, 'status', old.status, new.status);
  end if;
  if new.review_state is distinct from old.review_state then
    perform public.log_ad_campaign_activity(new.id, 'review', old.review_state, new.review_state);
  end if;
  if v_new_dates is distinct from v_old_dates then
    perform public.log_ad_campaign_activity(new.id, 'dates', nullif(v_old_dates, ''), nullif(v_new_dates, ''));
  end if;
  if new.title is distinct from old.title then
    perform public.log_ad_campaign_activity(new.id, 'title', old.title, new.title);
  end if;
  if new.budget_global is distinct from old.budget_global then
    perform public.log_ad_campaign_activity(new.id, 'budget', old.budget_global, new.budget_global);
  end if;
  if new.lead_id is distinct from old.lead_id then
    perform public.log_ad_campaign_activity(
      new.id,
      'lead',
      public.member_display_name(old.lead_id),
      public.member_display_name(new.lead_id)
    );
  end if;
  return null;
end$$;

drop trigger if exists ad_campaigns_activity_trg on public.ad_campaigns;
create trigger ad_campaigns_activity_trg
  after update on public.ad_campaigns
  for each row execute function public.ad_campaigns_log_activity();

create or replace function public.list_ad_campaign_activity(p_campaign_id uuid)
returns table (
  id          uuid,
  field       text,
  old_value   text,
  new_value   text,
  created_at  timestamptz,
  actor_label text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.field,
    a.old_value,
    a.new_value,
    a.created_at,
    case when a.actor_id is null then null
         else public.member_display_name(a.actor_id)
    end
  from public.ad_campaign_activity a
  where a.campaign_id = p_campaign_id
    and public.is_brand_writer(
      (select c.brand_id from public.ad_campaigns c where c.id = p_campaign_id)
    )
  order by a.created_at desc
  limit 100;
$$;

revoke all on function public.list_ad_campaign_activity(uuid) from public;
grant execute on function public.list_ad_campaign_activity(uuid) to authenticated;

-- =====================================================================
-- Le statut suit les dates, à la lecture : même principe que
-- `recompute_live_statuses`, pas de tâche planifiée à entretenir.
--   Validée, période commencée et pas finie → En cours.
--   En cours, période finie                 → Terminée.
-- Brouillon et Arrêtée ne bougent jamais : un brouillon n'a été validé par
-- personne, et un arrêt est une décision.
-- =====================================================================
create or replace function public.recompute_ad_statuses(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_brand_member(p_brand_id) then
    raise exception 'not_authorized';
  end if;

  perform set_config('kreatly.system_change', '1', true);

  update public.ad_campaigns
  set status = 'live'
  where brand_id = p_brand_id
    and status in ('approved', 'scheduled')
    and date_start is not null
    and date_start <= current_date
    and (date_end is null or date_end >= current_date);

  update public.ad_campaigns
  set status = 'completed'
  where brand_id = p_brand_id
    and status = 'live'
    and date_end is not null
    and date_end < current_date;

  perform set_config('kreatly.system_change', '', true);
end$$;

revoke all on function public.recompute_ad_statuses(uuid) from public;
grant execute on function public.recompute_ad_statuses(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
