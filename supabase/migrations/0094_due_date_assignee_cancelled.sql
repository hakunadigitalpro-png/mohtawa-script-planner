-- Lot 2 repris du content calendar d'Airtable :
--   - une ÉCHÉANCE de production, distincte de la date de publication : « prêt
--     pour le 12 » n'est pas « en ligne le 15 ». Le calendrier ne disait que
--     la seconde, donc les retards se voyaient le jour de la publication ;
--   - un RESPONSABLE par contenu, parmi l'équipe de la marque ;
--   - un statut « Annulé » : abandonner sans supprimer, et pouvoir reprendre.
--
-- Ajouts uniquement : aucune ligne existante n'est modifiée.

alter table public.contents
  add column if not exists due_date date;
alter table public.contents
  add column if not exists assignee_id uuid references auth.users(id) on delete set null;

create index if not exists contents_assignee_idx
  on public.contents (assignee_id)
  where assignee_id is not null;
create index if not exists contents_brand_due_idx
  on public.contents (brand_id, due_date)
  where due_date is not null;

alter table public.contents
  drop constraint if exists contents_status_check;
alter table public.contents
  add constraint contents_status_check
  check (status in (
    'idea', 'selected',
    'script', 'filming', 'editing', 'scheduled', 'published',
    'design', 'pending_review', 'needs_revision', 'approved', 'programmed', 'live',
    'cancelled'
  ));

-- Le responsable fait partie de l'équipe de CETTE marque. Vérifié en base : un
-- identifiant envoyé à la main ne doit pas désigner quelqu'un d'une autre marque.
create or replace function public.contents_check_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (
       select 1 from public.brand_members m
       where m.brand_id = new.brand_id
         and m.user_id = new.assignee_id
         and m.role <> 'viewer'
     )
  then
    raise exception 'assignee_not_member';
  end if;
  return new;
end$$;

drop trigger if exists contents_check_assignee_trg on public.contents;
create trigger contents_check_assignee_trg
  before insert or update of assignee_id on public.contents
  for each row execute function public.contents_check_assignee();

-- Quelqu'un quitte la marque : ses contenus n'ont plus de responsable, plutôt
-- qu'un nom que plus personne ne peut joindre.
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
  return null;
end$$;

drop trigger if exists brand_members_clear_assignee_trg on public.brand_members;
create trigger brand_members_clear_assignee_trg
  after delete on public.brand_members
  for each row execute function public.brand_members_clear_assignee();

-- =====================================================================
-- Historique : l'échéance et le responsable y entrent aussi.
-- =====================================================================
alter table public.content_activity
  drop constraint if exists content_activity_field_check;
alter table public.content_activity
  add constraint content_activity_field_check check (
    field in (
      'status', 'date', 'title', 'caption', 'visual_added', 'visual_removed',
      'due_date', 'assignee'
    )
  );

-- Reprise de 0093 : l'échéance fusionne comme les autres champs édités en série.
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
  if p_field in ('title', 'caption', 'date', 'due_date') then
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

revoke all on function public.log_content_activity(uuid, text, text, text)
  from public, anon, authenticated;

-- Le prénom est écrit dans l'historique : il doit rester lisible même une fois
-- la personne partie de la marque.
create or replace function public.member_display_name(p_user uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    nullif(split_part(btrim(u.raw_user_meta_data ->> 'full_name'), ' ', 1), ''),
    split_part(u.email::text, '@', 1)
  )
  from auth.users u
  where u.id = p_user;
$$;

revoke all on function public.member_display_name(uuid)
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
  if new.due_date is distinct from old.due_date then
    perform public.log_content_activity(new.id, 'due_date', old.due_date::text, new.due_date::text);
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    perform public.log_content_activity(
      new.id,
      'assignee',
      public.member_display_name(old.assignee_id),
      public.member_display_name(new.assignee_id)
    );
  end if;
  return null;
end$$;

select pg_notify('pgrst', 'reload schema');
