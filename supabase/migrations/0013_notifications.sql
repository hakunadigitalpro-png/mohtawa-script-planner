-- =====================================================================
-- 0013 — Notifications + Realtime sur les commentaires
--
-- 1. Table `notifications` : une row par membre de la brand à chaque
--    nouveau commentaire (invité ou équipe). Sert au panneau cloche dans
--    la sidebar.
-- 2. Trigger AFTER INSERT sur `content_comments` qui crée les notifs.
-- 3. RPCs : list_my_notifications, mark_notification_read,
--    mark_all_notifications_read, count_my_unread_notifications.
-- 4. Active Realtime sur `content_comments` ET `notifications`.
--
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

-- 1) Table notifications -----------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  content_id  uuid references public.contents(id) on delete cascade,
  comment_id  uuid references public.content_comments(id) on delete cascade,
  type        text not null default 'comment' check (type in ('comment')),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Indexes : surtout pour "mes notifs non-lues, du plus récent au plus vieux"
create index if not exists notifications_user_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read, created_at desc)
  where read = false;

-- 2) RLS ---------------------------------------------------------------
alter table public.notifications enable row level security;

-- Lecture : chaque user ne voit que ses propres notifs
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- Update : chaque user peut marquer ses notifs comme lues
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid());

-- Pas de policy INSERT : seul le trigger (security definer) insère.
-- Pas de policy DELETE : on garde l'historique pour l'instant.

-- 3) Trigger : crée une notif par membre de la brand --------------------
create or replace function public.notify_brand_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
begin
  -- Récupère la brand_id depuis le content parent
  select brand_id into v_brand_id
  from public.contents
  where id = new.content_id;

  if v_brand_id is null then
    return new;
  end if;

  -- Pour chaque membre de la brand, sauf l'auteur du commentaire :
  -- - Si new.user_id is null (commentaire invité) → on notifie TOUT le monde
  -- - Sinon → on exclut l'auteur
  insert into public.notifications (user_id, content_id, comment_id, type)
  select m.user_id, new.content_id, new.id, 'comment'
  from public.brand_members m
  where m.brand_id = v_brand_id
    and (new.user_id is null or m.user_id <> new.user_id);

  return new;
end$$;

drop trigger if exists content_comments_notify on public.content_comments;
create trigger content_comments_notify
  after insert on public.content_comments
  for each row execute function public.notify_brand_on_comment();

-- 4) RPC : list_my_notifications ---------------------------------------
-- Retourne les N dernières notifs de l'user courant avec assez de contexte
-- pour rendre une ligne lisible ("Mariam (Invité) a commenté sur 'Mon Reel'").
create or replace function public.list_my_notifications(p_limit int default 20)
returns table (
  id                  uuid,
  content_id          uuid,
  comment_id          uuid,
  type                text,
  read                boolean,
  created_at          timestamptz,
  content_title       text,
  comment_target_type text,
  comment_target_id   text,
  comment_body        text,
  guest_name          text,
  author_email        text,
  is_guest            boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  select
    n.id,
    n.content_id,
    n.comment_id,
    n.type,
    n.read,
    n.created_at,
    c.title              as content_title,
    cc.target_type       as comment_target_type,
    cc.target_id         as comment_target_id,
    cc.body              as comment_body,
    cc.guest_name        as guest_name,
    u.email::text        as author_email,
    (cc.user_id is null) as is_guest
  from public.notifications n
  left join public.contents c           on c.id  = n.content_id
  left join public.content_comments cc  on cc.id = n.comment_id
  left join auth.users u                on u.id  = cc.user_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit p_limit;
end$$;

revoke all on function public.list_my_notifications(int) from public;
grant execute on function public.list_my_notifications(int) to authenticated;

-- 5) RPC : count_my_unread_notifications -------------------------------
create or replace function public.count_my_unread_notifications()
returns bigint
language sql
security invoker
stable
as $$
  select count(*)::bigint
  from public.notifications
  where user_id = auth.uid() and read = false;
$$;

revoke all on function public.count_my_unread_notifications() from public;
grant execute on function public.count_my_unread_notifications() to authenticated;

-- 6) RPC : mark_notification_read --------------------------------------
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update public.notifications
  set read = true
  where id = p_notification_id and user_id = auth.uid();
end$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- 7) RPC : mark_all_notifications_read ---------------------------------
create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security invoker
as $$
begin
  update public.notifications
  set read = true
  where user_id = auth.uid() and read = false;
end$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- 8) Active Realtime ---------------------------------------------------
-- Permet aux clients Supabase de s'abonner aux INSERT/UPDATE/DELETE.
-- IMPORTANT : DROP IF EXISTS d'abord (PG ne supporte pas IF NOT EXISTS
-- sur ALTER PUBLICATION ADD TABLE).
do $$
begin
  -- content_comments : pour le live refresh sur la page /content/[id]
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'content_comments'
  ) then
    alter publication supabase_realtime add table public.content_comments;
  end if;

  -- notifications : pour le badge live dans la sidebar
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end$$;
