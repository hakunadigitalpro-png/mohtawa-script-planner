-- =====================================================================
-- 0002 — Rend les inserts plus robustes en remplissant
--        created_by / user_id côté DB via triggers BEFORE INSERT.
-- Idempotent.
-- =====================================================================

-- brands.created_by -> auth.uid() ---------------------------------------
create or replace function public.brands_default_created_by()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.created_by is null then
    raise exception 'not_authenticated';
  end if;
  return new;
end$$;

drop trigger if exists brands_set_created_by on public.brands;
create trigger brands_set_created_by
  before insert on public.brands
  for each row execute function public.brands_default_created_by();

-- contents.user_id -> auth.uid() ----------------------------------------
create or replace function public.contents_default_user_id()
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

drop trigger if exists contents_set_user_id on public.contents;
create trigger contents_set_user_id
  before insert on public.contents
  for each row execute function public.contents_default_user_id();

-- Helper de diagnostic --------------------------------------------------
-- Permet à l'app d'appeler supabase.rpc('whoami') et de récupérer
-- l'auth.uid() vu par PostgREST sous la session courante.
create or replace function public.whoami()
returns uuid
language sql
security invoker
stable
as $$
  select auth.uid();
$$;

revoke all on function public.whoami() from public;
grant execute on function public.whoami() to authenticated;
