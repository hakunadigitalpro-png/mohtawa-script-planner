-- Fait évoluer "personal_tasks" (perso, migration 0048) en un vrai board
-- Kanban partagé avec l'équipe de la marque : responsable assignable,
-- 3 colonnes de statut (à faire / en cours / fait) au lieu d'une case à
-- cocher. Rôle "viewer" (client invité) volontairement exclu — même
-- traitement que le reste de l'app (Dashboard/Analytics/Hooks/Brands).
--
-- brand_id reste NULLABLE (pas de backfill garanti à 100% pour les tâches
-- perso créées avant cette migration sans contenu lié) : la policy RLS
-- gère les deux cas — une tâche avec brand_id est visible par toute
-- l'équipe, une tâche sans brand_id (legacy orpheline) reste visible
-- seulement par sa créatrice. Aucune perte de données.

alter table public.personal_tasks rename to tasks;

alter table public.tasks
  add column if not exists brand_id uuid references public.brands(id) on delete cascade,
  add column if not exists assignee_id uuid references auth.users(id) on delete set null,
  add column if not exists status text;

-- Backfill du statut depuis l'ancienne case à cocher, puis contrainte.
update public.tasks set status = case when done then 'done' else 'todo' end
  where status is null;
alter table public.tasks alter column status set not null;
alter table public.tasks alter column status set default 'todo';
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('todo', 'in_progress', 'done'));

alter table public.tasks drop column if exists done;

-- Backfill de brand_id depuis le contenu lié, quand il y en a un.
update public.tasks t set brand_id = c.brand_id
  from public.contents c
  where t.content_id = c.id and t.brand_id is null;

drop index if exists public.personal_tasks_user_id_idx;
create index if not exists tasks_brand_id_idx on public.tasks (brand_id, status, created_at);
create index if not exists tasks_user_id_idx on public.tasks (user_id, status, created_at);
create index if not exists tasks_assignee_id_idx on public.tasks (assignee_id) where assignee_id is not null;

-- ===== RLS : équipe de la marque (si brand_id renseigné), sinon créatrice
-- uniquement (tâches legacy orphelines, avant cette migration) =====

drop policy if exists personal_tasks_select_own on public.tasks;
drop policy if exists personal_tasks_insert_own on public.tasks;
drop policy if exists personal_tasks_update_own on public.tasks;
drop policy if exists personal_tasks_delete_own on public.tasks;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (
    (brand_id is not null and public.is_brand_member(brand_id))
    or user_id = auth.uid()
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert with check (
    user_id = auth.uid()
    and (brand_id is null or public.is_brand_member(brand_id))
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (
    (brand_id is not null and public.is_brand_member(brand_id))
    or user_id = auth.uid()
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete using (
    (brand_id is not null and public.is_brand_member(brand_id))
    or user_id = auth.uid()
  );

create or replace function public.tasks_default_user_id()
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

drop trigger if exists personal_tasks_set_user_id on public.tasks;
drop trigger if exists tasks_set_user_id on public.tasks;
create trigger tasks_set_user_id
  before insert on public.tasks
  for each row execute function public.tasks_default_user_id();

drop function if exists public.personal_tasks_default_user_id();
