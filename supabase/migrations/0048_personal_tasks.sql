-- "Mes tâches" : bloc-notes perso de l'utilisatrice, PAS partagé avec les
-- autres membres de la marque (contrairement à content_checklist_items qui
-- reste par vidéo). RLS simple sur auth.uid(), pas de is_brand_member().

create table if not exists public.personal_tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Renseignés quand la tâche vient d'une notification, pour rebondir vers
  -- la vidéo concernée. Snapshot du titre (pas un join live) : simple, et
  -- reste correct même si la vidéo est renommée ensuite.
  content_id    uuid references public.contents(id) on delete set null,
  content_title text,
  label         text not null,
  priority      text not null default 'normal' check (priority in ('urgent', 'normal')),
  done          boolean not null default false,
  created_at    timestamptz not null default now(),
  done_at       timestamptz
);

create index if not exists personal_tasks_user_id_idx
  on public.personal_tasks (user_id, done, created_at);

alter table public.personal_tasks enable row level security;

drop policy if exists personal_tasks_select_own on public.personal_tasks;
create policy personal_tasks_select_own on public.personal_tasks
  for select using (user_id = auth.uid());

drop policy if exists personal_tasks_insert_own on public.personal_tasks;
create policy personal_tasks_insert_own on public.personal_tasks
  for insert with check (user_id = auth.uid());

drop policy if exists personal_tasks_update_own on public.personal_tasks;
create policy personal_tasks_update_own on public.personal_tasks
  for update using (user_id = auth.uid());

drop policy if exists personal_tasks_delete_own on public.personal_tasks;
create policy personal_tasks_delete_own on public.personal_tasks
  for delete using (user_id = auth.uid());

-- personal_tasks.user_id -> auth.uid() (même style que contents_default_user_id,
-- migration 0002) ------------------------------------------------------
create or replace function public.personal_tasks_default_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.user_id is null then
    raise exception 'not_authenticated';
  end if;
  return new;
end$$;

drop trigger if exists personal_tasks_set_user_id on public.personal_tasks;
create trigger personal_tasks_set_user_id
  before insert on public.personal_tasks
  for each row execute function public.personal_tasks_default_user_id();
