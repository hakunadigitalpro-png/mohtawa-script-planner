-- 0011_checklist_items.sql
-- New checklist items per video : equipment to bring + shooting preparation.
-- Replaces the "I forgot the SD card" syndrome with a real pre-production
-- helper. Free-form items, atomic CRUD, brand-scoped suggestions.

-- ============================ Table ============================
create table if not exists public.content_checklist_items (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  -- 'equipment' = gear to bring (camera, tripod, mic, etc.)
  -- 'preparation' = setup tasks (location booked, outfit ready, etc.)
  category text not null check (category in ('equipment', 'preparation')),
  label text not null check (length(trim(label)) > 0),
  position int not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_checklist_items_content
  on public.content_checklist_items(content_id, category, position);

-- ============================ RLS ============================
alter table public.content_checklist_items enable row level security;

drop policy if exists "content_checklist_items_select" on public.content_checklist_items;
create policy "content_checklist_items_select"
  on public.content_checklist_items
  for select
  using (
    public.is_brand_member(
      (select brand_id from public.contents where id = content_id)
    )
  );

drop policy if exists "content_checklist_items_insert" on public.content_checklist_items;
create policy "content_checklist_items_insert"
  on public.content_checklist_items
  for insert
  with check (
    public.is_brand_member(
      (select brand_id from public.contents where id = content_id)
    )
  );

drop policy if exists "content_checklist_items_update" on public.content_checklist_items;
create policy "content_checklist_items_update"
  on public.content_checklist_items
  for update
  using (
    public.is_brand_member(
      (select brand_id from public.contents where id = content_id)
    )
  );

drop policy if exists "content_checklist_items_delete" on public.content_checklist_items;
create policy "content_checklist_items_delete"
  on public.content_checklist_items
  for delete
  using (
    public.is_brand_member(
      (select brand_id from public.contents where id = content_id)
    )
  );

-- ============================ Suggestion RPC ============================
-- Returns the items used most often across the brand's last 3 videos so the
-- user doesn't have to retype "Caméra / Trépied / Micro" on every new video.
-- Sorted by usage frequency then recency. Caller filters by category.
create or replace function public.recent_brand_checklist_labels(
  p_brand_id uuid,
  p_category text default null,
  p_limit int default 20
)
returns table (
  label text,
  category text,
  usage_count bigint
)
language plpgsql
security invoker
stable
as $$
begin
  -- Permission check (the RPC itself isn't security definer, but we still
  -- guard explicitly for clarity)
  if not public.is_brand_member(p_brand_id) then
    return;
  end if;

  return query
  with recent_videos as (
    select id from public.contents
    where brand_id = p_brand_id
    order by created_at desc
    limit 3
  )
  select
    ci.label,
    ci.category,
    count(*)::bigint as usage_count
  from public.content_checklist_items ci
  join recent_videos rv on ci.content_id = rv.id
  where (p_category is null or ci.category = p_category)
  group by ci.label, ci.category
  order by usage_count desc, max(ci.created_at) desc
  limit p_limit;
end;
$$;

revoke all on function public.recent_brand_checklist_labels(uuid, text, int) from public;
grant execute on function public.recent_brand_checklist_labels(uuid, text, int) to authenticated;
