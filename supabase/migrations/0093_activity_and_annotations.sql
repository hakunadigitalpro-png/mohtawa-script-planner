-- Repris du content calendar d'Airtable, testé en vrai le 06/11/2026 :
--   1. Un fil d'activité par contenu : qui a changé le statut, la date, le
--      titre, la légende, les visuels — et quand. Rien ne le disait avant.
--   2. Une remarque peut viser une ZONE de l'image (un rectangle), plus
--      seulement le visuel entier. « Ce logo-là », sans avoir à le décrire.
--
-- Ajouts uniquement : aucune donnée existante n'est modifiée. L'historique
-- commence à cette migration.

-- =====================================================================
-- 1) Zone visée par un commentaire, en fractions de l'image (0 à 1) : elle
--    tient quelle que soit la taille à laquelle l'image s'affiche.
-- =====================================================================
alter table public.content_comments
  add column if not exists anchor jsonb;

alter table public.content_comments
  drop constraint if exists content_comments_anchor_check;
alter table public.content_comments
  add constraint content_comments_anchor_check check (
    anchor is null or (
      target_type = 'media'
      and jsonb_typeof(anchor) = 'object'
      and (anchor ->> 'x')::numeric between 0 and 1
      and (anchor ->> 'y')::numeric between 0 and 1
      and (anchor ->> 'w')::numeric > 0 and (anchor ->> 'w')::numeric <= 1
      and (anchor ->> 'h')::numeric > 0 and (anchor ->> 'h')::numeric <= 1
    )
  );

-- La liste des commentaires remonte la zone. Le type de retour change : il
-- faut supprimer la fonction avant de la recréer.
drop function if exists public.list_content_comments_with_authors(uuid);

create function public.list_content_comments_with_authors(
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
  anchor       jsonb,
  created_at   timestamptz,
  updated_at   timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  -- `contents` aliasé en `ct` : `id` seul serait ambigu avec le RETURNS TABLE.
  if not public.is_brand_member(
    (select brand_id from public.contents ct where ct.id = p_content_id)
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
    c.anchor,
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

-- La validation client accepte une zone par remarque. Reprise de 0057 à
-- l'identique, sauf l'écriture de `anchor`.
create or replace function public.client_review_content_many(
  p_content_id uuid,
  p_decision   text,                        -- 'approve' | 'revise'
  p_notes      jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_status   text;
  v_note     jsonb;
  v_body     text;
  v_media    uuid;
  v_anchor   jsonb;
  v_kept     int  := 0;
  v_first    uuid := null;
  v_new      uuid;
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

  -- Tout membre, pas seulement le client : l'équipe relit parfois avant lui.
  if not public.is_brand_member(v_brand_id) then
    raise exception 'Forbidden';
  end if;

  if v_status <> 'pending_review' then
    raise exception 'not_pending';
  end if;

  -- On valide TOUT avant d'écrire quoi que ce soit : chaque cible doit être
  -- un visuel DE CE CONTENU.
  for v_note in select * from jsonb_array_elements(coalesce(p_notes, '[]'::jsonb))
  loop
    v_body := nullif(btrim(coalesce(v_note ->> 'body', '')), '');
    if v_body is null then
      continue;
    end if;

    v_media := nullif(v_note ->> 'media_id', '')::uuid;
    if v_media is not null and not exists (
      select 1 from public.content_media m
      where m.id = v_media and m.content_id = p_content_id
    ) then
      raise exception 'invalid_media';
    end if;

    v_kept := v_kept + 1;
  end loop;

  if p_decision = 'revise' and v_kept = 0 then
    raise exception 'empty_revision';
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

  -- Le drapeau : le trigger laisse passer, on notifiera une seule fois.
  perform set_config('kreatly.batch_comments', '1', true);

  for v_note in select * from jsonb_array_elements(coalesce(p_notes, '[]'::jsonb))
  loop
    v_body := nullif(btrim(coalesce(v_note ->> 'body', '')), '');
    if v_body is null then
      continue;
    end if;
    v_media := nullif(v_note ->> 'media_id', '')::uuid;
    -- Une zone n'a de sens que sur un visuel. La contrainte de la table
    -- refuse une zone mal formée.
    v_anchor := case
      when v_media is null then null
      else nullif(v_note -> 'anchor', 'null'::jsonb)
    end;

    insert into public.content_comments (
      content_id, target_type, target_id, user_id, body, anchor
    ) values (
      p_content_id,
      case when v_media is null then 'plan' else 'media' end,
      case when v_media is null then 'general' else v_media::text end,
      auth.uid(),
      left(v_body, 2000),
      v_anchor
    )
    returning id into v_new;

    if v_first is null then
      v_first := v_new;
    end if;
  end loop;

  perform set_config('kreatly.batch_comments', '', true);

  -- UNE notification, qui pointe la première remarque : la cloche dit « ton
  -- client a répondu », pas « ton client a écrit, écrit, écrit, écrit ».
  if v_first is not null then
    insert into public.notifications (user_id, content_id, comment_id, type)
    select m.user_id, p_content_id, v_first, 'comment'
    from public.brand_members m
    where m.brand_id = v_brand_id
      and m.user_id is distinct from auth.uid();
  end if;
end$$;

revoke all on function public.client_review_content_many(uuid, text, jsonb) from public;
grant execute on function public.client_review_content_many(uuid, text, jsonb) to authenticated;

-- =====================================================================
-- 2) L'historique. Écrit seulement par les triggers ; lu seulement par la
--    RPC, réservée à l'équipe : un client n'a pas à voir « Tournage ».
-- =====================================================================
create table if not exists public.content_activity (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  -- Null : c'est Kreatly (passage automatique en ligne à la date).
  actor_id   uuid,
  field      text not null check (
    field in ('status', 'date', 'title', 'caption', 'visual_added', 'visual_removed')
  ),
  old_value  text,
  new_value  text,
  created_at timestamptz not null default now()
);
create index if not exists content_activity_content_idx
  on public.content_activity (content_id, created_at desc);

-- Aucune policy : ni lecture ni écriture directes.
alter table public.content_activity enable row level security;

create or replace function public.log_content_activity(
  p_content uuid,
  p_field   text,
  p_old     text,
  p_new     text
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
  -- Ni utilisateur ni Kreatly : une migration ou une reprise de données, pas
  -- un geste de quelqu'un.
  if v_actor is null and not v_system then
    return;
  end if;

  -- L'autosave écrit à chaque pause de frappe : dix minutes d'édition du même
  -- champ par la même personne font UNE ligne, pas cinquante.
  if p_field in ('title', 'caption', 'date') then
    select a.id, a.old_value into v_last
    from public.content_activity a
    where a.content_id = p_content
      and a.field = p_field
      and a.actor_id is not distinct from v_actor
      and a.created_at > now() - interval '10 minutes'
    order by a.created_at desc
    limit 1;

    if found then
      if p_new is not null and v_last.old_value is not distinct from p_new then
        -- Revenue à la valeur de départ : il ne s'est rien passé.
        delete from public.content_activity where id = v_last.id;
      else
        update public.content_activity
        set new_value = p_new, created_at = now()
        where id = v_last.id;
      end if;
      return;
    end if;
  end if;

  insert into public.content_activity (content_id, actor_id, field, old_value, new_value)
  values (p_content, v_actor, p_field, p_old, p_new);
end$$;

-- Personne ne peut écrire dans l'historique en appelant la fonction : seuls
-- les triggers ci-dessous s'en servent, avec les droits de leur propriétaire.
revoke all on function public.log_content_activity(uuid, text, text, text)
  from public, anon, authenticated;

create or replace function public.contents_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_content_activity(new.id, 'status', old.status, new.status);
  end if;
  if new.date is distinct from old.date then
    perform public.log_content_activity(new.id, 'date', old.date::text, new.date::text);
  end if;
  if new.title is distinct from old.title then
    perform public.log_content_activity(new.id, 'title', old.title, new.title);
  end if;
  -- La légende peut faire 2 000 caractères : on note le geste, pas le texte.
  if new.caption is distinct from old.caption then
    perform public.log_content_activity(new.id, 'caption', null, null);
  end if;
  return null;
end$$;

drop trigger if exists contents_activity_trg on public.contents;
create trigger contents_activity_trg
  after update on public.contents
  for each row execute function public.contents_log_activity();

create or replace function public.content_media_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_content_activity(new.content_id, 'visual_added', null, null);
  -- Suppression d'un contenu : le cascade efface ses visuels APRÈS lui. Écrire
  -- l'historique d'un contenu qui n'existe plus ferait échouer la suppression.
  elsif exists (select 1 from public.contents c where c.id = old.content_id) then
    perform public.log_content_activity(old.content_id, 'visual_removed', null, null);
  end if;
  return null;
end$$;

drop trigger if exists content_media_activity_trg on public.content_media;
create trigger content_media_activity_trg
  after insert or delete on public.content_media
  for each row execute function public.content_media_log_activity();

create or replace function public.list_content_activity(p_content_id uuid)
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
    case when a.actor_id is null then null else
      coalesce(
        nullif(split_part(btrim(u.raw_user_meta_data ->> 'full_name'), ' ', 1), ''),
        split_part(u.email::text, '@', 1)
      )
    end
  from public.content_activity a
  left join auth.users u on u.id = a.actor_id
  where a.content_id = p_content_id
    and public.is_brand_writer(
      (select ct.brand_id from public.contents ct where ct.id = p_content_id)
    )
  order by a.created_at desc
  limit 200;
$$;

revoke all on function public.list_content_activity(uuid) from public;
grant execute on function public.list_content_activity(uuid) to authenticated;

-- Le passage automatique en ligne est lancé par celui qui ouvre la page : sans
-- ce drapeau, l'historique dirait que c'est lui qui a mis le contenu en ligne.
-- Reprise de 0045 à l'identique, sauf le set_config.
create or replace function public.recompute_live_statuses(p_brand_id uuid)
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

  -- Post / carrousel / infographie : "programmed" → "live"
  update public.contents c
  set status = 'live'
  where c.brand_id = p_brand_id
    and c.status = 'programmed'
    and c.type in ('post', 'carousel', 'infographic')
    and exists (
      select 1 from public.content_publications p
      where p.content_id = c.id
        and p.scheduled_date is not null
        and (p.scheduled_date::timestamp + coalesce(p.scheduled_time, '00:00'::time)) <= now()
    );

  -- Reel / story / vlog : "scheduled" → "live"
  update public.contents c
  set status = 'live'
  where c.brand_id = p_brand_id
    and c.status = 'scheduled'
    and c.type in ('reel', 'story', 'vlog')
    and exists (
      select 1 from public.content_publications p
      where p.content_id = c.id
        and p.scheduled_date is not null
        and (p.scheduled_date::timestamp + coalesce(p.scheduled_time, '00:00'::time)) <= now()
    );

  perform set_config('kreatly.system_change', '', true);
end$$;

revoke all on function public.recompute_live_statuses(uuid) from public;
grant execute on function public.recompute_live_statuses(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
