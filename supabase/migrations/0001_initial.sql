-- =====================================================================
-- Mohtawa Script Planner — Initial schema (idempotent)
-- Safe to run multiple times.
-- =====================================================================

-- Required extensions ---------------------------------------------------
create extension if not exists "pgcrypto";

-- =====================================================================
-- TABLES
-- =====================================================================

-- brands ---------------------------------------------------------------
create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- brand_members --------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'brand_role') then
    create type public.brand_role as enum ('owner','admin','editor','viewer');
  end if;
end$$;

create table if not exists public.brand_members (
  brand_id  uuid not null references public.brands(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      public.brand_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);

-- contents -------------------------------------------------------------
create table if not exists public.contents (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('reel','story','carousel','post','thread')),
  title       text,
  date        date,
  platform    text,
  status      text not null default 'idea'
              check (status in ('idea','script','filming','editing','scheduled','published')),
  pillar      text,
  objective   text,
  hook        text,
  cta         text,
  tags        text[] default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contents_brand_idx       on public.contents(brand_id);
create index if not exists contents_brand_date_idx  on public.contents(brand_id, date);
create index if not exists contents_user_idx        on public.contents(user_id);

-- reel_details ---------------------------------------------------------
create table if not exists public.reel_details (
  content_id   uuid primary key references public.contents(id) on delete cascade,
  message_key  text,
  intro        text,
  point1       text,
  point2       text,
  point3       text,
  transition   text,
  recap        text,
  outro        text,
  script_full  text,
  checklist    jsonb not null default '{}'::jsonb
);

-- story_details --------------------------------------------------------
create table if not exists public.story_details (
  content_id  uuid primary key references public.contents(id) on delete cascade,
  objective   text,
  cta_soft    text,
  format      text,
  story1      text,
  story2      text,
  story3      text,
  story4      text,
  story5      text
);

-- storyboard_scenes ----------------------------------------------------
create table if not exists public.storyboard_scenes (
  id              uuid primary key default gen_random_uuid(),
  content_id      uuid not null references public.contents(id) on delete cascade,
  scene_number    int  not null check (scene_number between 1 and 50),
  description     text,
  camera_angle    text,
  on_screen_text  text,
  tag             text,
  unique (content_id, scene_number)
);

create index if not exists storyboard_content_idx
  on public.storyboard_scenes(content_id);

-- performances ---------------------------------------------------------
create table if not exists public.performances (
  content_id  uuid primary key references public.contents(id) on delete cascade,
  views       int,
  likes       int,
  comments    int,
  shares      int,
  saves       int,
  retention   numeric(5,2),
  notes       text,
  updated_at  timestamptz not null default now()
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Auto-update updated_at on contents & performances --------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists contents_set_updated_at on public.contents;
create trigger contents_set_updated_at
  before update on public.contents
  for each row execute function public.set_updated_at();

drop trigger if exists performances_set_updated_at on public.performances;
create trigger performances_set_updated_at
  before update on public.performances
  for each row execute function public.set_updated_at();

-- When a brand is created, the creator becomes owner -------------------
create or replace function public.add_brand_creator_as_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.brand_members(brand_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (brand_id, user_id) do nothing;
  return new;
end$$;

drop trigger if exists brands_add_owner on public.brands;
create trigger brands_add_owner
  after insert on public.brands
  for each row execute function public.add_brand_creator_as_owner();

-- =====================================================================
-- HELPER FUNCTION — is_brand_member (used by RLS)
-- SECURITY DEFINER to avoid recursion in policies.
-- =====================================================================
create or replace function public.is_brand_member(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brand_members
    where brand_id = b and user_id = auth.uid()
  );
$$;

revoke all on function public.is_brand_member(uuid) from public;
grant execute on function public.is_brand_member(uuid) to authenticated;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.brands             enable row level security;
alter table public.brand_members      enable row level security;
alter table public.contents           enable row level security;
alter table public.reel_details       enable row level security;
alter table public.story_details      enable row level security;
alter table public.storyboard_scenes  enable row level security;
alter table public.performances       enable row level security;

-- brands ---------------------------------------------------------------
drop policy if exists "brands_select_members" on public.brands;
create policy "brands_select_members" on public.brands
  for select to authenticated
  using (public.is_brand_member(id));

drop policy if exists "brands_insert_self" on public.brands;
create policy "brands_insert_self" on public.brands
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "brands_update_owner" on public.brands;
create policy "brands_update_owner" on public.brands
  for update to authenticated
  using (
    exists (
      select 1 from public.brand_members m
      where m.brand_id = brands.id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

drop policy if exists "brands_delete_owner" on public.brands;
create policy "brands_delete_owner" on public.brands
  for delete to authenticated
  using (
    exists (
      select 1 from public.brand_members m
      where m.brand_id = brands.id and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- brand_members --------------------------------------------------------
drop policy if exists "members_select_self_or_member" on public.brand_members;
create policy "members_select_self_or_member" on public.brand_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_brand_member(brand_id));

drop policy if exists "members_insert_owner_admin" on public.brand_members;
create policy "members_insert_owner_admin" on public.brand_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.brand_members m
      where m.brand_id = brand_members.brand_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

drop policy if exists "members_delete_owner_admin_or_self" on public.brand_members;
create policy "members_delete_owner_admin_or_self" on public.brand_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.brand_members m
      where m.brand_id = brand_members.brand_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- contents -------------------------------------------------------------
drop policy if exists "contents_select_members" on public.contents;
create policy "contents_select_members" on public.contents
  for select to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "contents_insert_members" on public.contents;
create policy "contents_insert_members" on public.contents
  for insert to authenticated
  with check (public.is_brand_member(brand_id) and user_id = auth.uid());

drop policy if exists "contents_update_members" on public.contents;
create policy "contents_update_members" on public.contents
  for update to authenticated
  using (public.is_brand_member(brand_id));

drop policy if exists "contents_delete_members" on public.contents;
create policy "contents_delete_members" on public.contents
  for delete to authenticated
  using (public.is_brand_member(brand_id));

-- Generic RLS for content-children tables (reel_details, story_details, etc.) --
do $$
declare
  t text;
begin
  foreach t in array array['reel_details','story_details','storyboard_scenes','performances'] loop
    execute format($f$drop policy if exists "%s_select" on public.%I$f$, t, t);
    execute format($f$create policy "%s_select" on public.%I
      for select to authenticated
      using (exists (select 1 from public.contents c
                     where c.id = %I.content_id
                       and public.is_brand_member(c.brand_id)))$f$, t, t, t);

    execute format($f$drop policy if exists "%s_insert" on public.%I$f$, t, t);
    execute format($f$create policy "%s_insert" on public.%I
      for insert to authenticated
      with check (exists (select 1 from public.contents c
                          where c.id = %I.content_id
                            and public.is_brand_member(c.brand_id)))$f$, t, t, t);

    execute format($f$drop policy if exists "%s_update" on public.%I$f$, t, t);
    execute format($f$create policy "%s_update" on public.%I
      for update to authenticated
      using (exists (select 1 from public.contents c
                     where c.id = %I.content_id
                       and public.is_brand_member(c.brand_id)))$f$, t, t, t);

    execute format($f$drop policy if exists "%s_delete" on public.%I$f$, t, t);
    execute format($f$create policy "%s_delete" on public.%I
      for delete to authenticated
      using (exists (select 1 from public.contents c
                     where c.id = %I.content_id
                       and public.is_brand_member(c.brand_id)))$f$, t, t, t);
  end loop;
end$$;
