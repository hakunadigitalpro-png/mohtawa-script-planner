-- =====================================================================
-- 0009 — Commentaires sur les vidéos (Plan, Script, Storyboard, Stories)
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
--
-- Permet à l'équipe d'une marque de discuter à plusieurs sur chaque bloc
-- d'une vidéo : champ du Plan, champ du Script, scène du Storyboard, slide
-- de Story. Threads supportés (réponses imbriquées via parent_id).
-- =====================================================================

-- 1) Table content_comments -------------------------------------------
create table if not exists public.content_comments (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid not null references public.contents(id) on delete cascade,
  -- target_type : où le commentaire est ancré
  --   'plan'   → target_id = nom du champ ('general', 'title', 'hook'…)
  --   'script' → target_id = nom du champ ('intro', 'point1', 'point2'…)
  --   'scene'  → target_id = storyboard_scenes.id (UUID en string)
  --   'slide'  → target_id = slot_number (1-5 en string)
  target_type text not null check (target_type in ('plan','script','scene','slide')),
  target_id   text not null,
  parent_id   uuid references public.content_comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists content_comments_content_idx
  on public.content_comments(content_id);

create index if not exists content_comments_target_idx
  on public.content_comments(content_id, target_type, target_id);

create index if not exists content_comments_parent_idx
  on public.content_comments(parent_id);

drop trigger if exists content_comments_set_updated_at on public.content_comments;
create trigger content_comments_set_updated_at
  before update on public.content_comments
  for each row execute function public.set_updated_at();

-- 2) Table content_reads (suivi du "vu" par utilisateur) --------------
-- Approche simple : chaque user a une timestamp par content qui dit "j'ai
-- vu tous les commentaires antérieurs". On compte les non-lus avec :
--   count(created_at > last_comment_read_at AND user_id <> me)
create table if not exists public.content_reads (
  user_id              uuid not null references auth.users(id) on delete cascade,
  content_id           uuid not null references public.contents(id) on delete cascade,
  last_comment_read_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

create index if not exists content_reads_content_idx
  on public.content_reads(content_id);

-- 3) RLS ----------------------------------------------------------------
alter table public.content_comments enable row level security;
alter table public.content_reads    enable row level security;

-- Lecture : tout membre de la brand parente
drop policy if exists "comments_select_members" on public.content_comments;
create policy "comments_select_members" on public.content_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.contents c
      where c.id = content_comments.content_id
        and public.is_brand_member(c.brand_id)
    )
  );

-- Insert : tout membre de la brand parente (et user_id = auth.uid())
drop policy if exists "comments_insert_members" on public.content_comments;
create policy "comments_insert_members" on public.content_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.contents c
      where c.id = content_comments.content_id
        and public.is_brand_member(c.brand_id)
    )
  );

-- Update :
--   - L'auteur peut éditer le body
--   - N'importe quel membre peut toggle "resolved" sur les commentaires racine
drop policy if exists "comments_update_members" on public.content_comments;
create policy "comments_update_members" on public.content_comments
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.contents c
      where c.id = content_comments.content_id
        and public.is_brand_member(c.brand_id)
    )
  );

-- Delete : l'auteur ou owner/admin de la brand
drop policy if exists "comments_delete_members" on public.content_comments;
create policy "comments_delete_members" on public.content_comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.contents c
      join public.brand_members m on m.brand_id = c.brand_id
      where c.id = content_comments.content_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- Reads : chaque user gère uniquement ses propres reads
drop policy if exists "reads_select_self" on public.content_reads;
create policy "reads_select_self" on public.content_reads
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "reads_upsert_self" on public.content_reads;
create policy "reads_upsert_self" on public.content_reads
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reads_update_self" on public.content_reads;
create policy "reads_update_self" on public.content_reads
  for update to authenticated
  using (user_id = auth.uid());

-- 4) RPC : list_content_comments_with_authors -------------------------
-- Retourne les commentaires d'une vidéo avec l'email de l'auteur.
-- (RLS de auth.users empêche l'accès direct depuis postgrest)
create or replace function public.list_content_comments_with_authors(
  p_content_id uuid
)
returns table (
  id          uuid,
  content_id  uuid,
  target_type text,
  target_id   text,
  parent_id   uuid,
  user_id     uuid,
  author_email text,
  body        text,
  resolved    boolean,
  created_at  timestamptz,
  updated_at  timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.contents c
    where c.id = p_content_id
      and public.is_brand_member(c.brand_id)
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    cc.id, cc.content_id, cc.target_type, cc.target_id, cc.parent_id,
    cc.user_id, u.email::text as author_email,
    cc.body, cc.resolved, cc.created_at, cc.updated_at
  from public.content_comments cc
  left join auth.users u on u.id = cc.user_id
  where cc.content_id = p_content_id
  order by cc.created_at asc;
end$$;

revoke all on function public.list_content_comments_with_authors(uuid) from public;
grant execute on function public.list_content_comments_with_authors(uuid) to authenticated;

-- 5) RPC : mark_content_read ------------------------------------------
-- Met à jour last_comment_read_at = now() pour le user courant.
create or replace function public.mark_content_read(p_content_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  insert into public.content_reads (user_id, content_id, last_comment_read_at)
  values (auth.uid(), p_content_id, now())
  on conflict (user_id, content_id)
  do update set last_comment_read_at = excluded.last_comment_read_at;
end$$;

revoke all on function public.mark_content_read(uuid) from public;
grant execute on function public.mark_content_read(uuid) to authenticated;

-- 6) RPC : count_unread_comments --------------------------------------
-- Renvoie, pour chaque vidéo dont le user est membre,
-- le nombre de commentaires créés après son last_comment_read_at,
-- en excluant ses propres commentaires.
create or replace function public.count_unread_comments()
returns table (content_id uuid, unread_count bigint)
language plpgsql
security invoker
stable
as $$
begin
  return query
  select c.id as content_id, count(cc.id)::bigint
  from public.contents c
  join public.content_comments cc on cc.content_id = c.id
  left join public.content_reads r
    on r.content_id = c.id and r.user_id = auth.uid()
  where public.is_brand_member(c.brand_id)
    and cc.user_id <> auth.uid()
    and cc.created_at > coalesce(r.last_comment_read_at, '1970-01-01'::timestamptz)
  group by c.id;
end$$;

revoke all on function public.count_unread_comments() from public;
grant execute on function public.count_unread_comments() to authenticated;
