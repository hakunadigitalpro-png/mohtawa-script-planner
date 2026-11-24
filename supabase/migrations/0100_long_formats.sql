-- =====================================================================
-- 0100 — Les formats longs : vidéo longue, direct, podcast, article
-- Idempotent. Aucune donnée existante n'est touchée.
--
--   1. `contents.type` accepte quatre valeurs de plus. Aucun statut nouveau :
--      chaque format suit l'une des deux familles existantes
--      (`FORMAT_SPECS`, lib/constants.ts).
--   2. `recompute_live_statuses` ne liste plus les formats : un format absent
--      de la liste restait « programmé » pour toujours, sans erreur.
--   3. `contents.source_content_id` : un extrait tiré d'un podcast est un VRAI
--      contenu (son statut, sa date, sa validation), relié à son origine.
-- =====================================================================

alter table public.contents
  drop constraint if exists contents_type_check;

alter table public.contents
  add constraint contents_type_check
  check (
    type is null
    or type in (
      'reel', 'story', 'vlog', 'post', 'carousel', 'infographic',
      'long_video', 'livestream', 'podcast', 'article'
    )
  );

-- ---------------------------------------------------------------------
-- Passage en ligne à la date — reprise de 0093 sans la liste de formats
-- ---------------------------------------------------------------------
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

  update public.contents c
  set status = 'live'
  where c.brand_id = p_brand_id
    and c.status in ('programmed', 'scheduled')
    and c.type is not null
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

-- ---------------------------------------------------------------------
-- L'origine d'un extrait
-- ---------------------------------------------------------------------
-- `set null` : supprimer le podcast ne supprime pas les Reels qu'on en a tirés.
alter table public.contents
  add column if not exists source_content_id uuid
  references public.contents(id) on delete set null;

create index if not exists contents_source_idx
  on public.contents (source_content_id)
  where source_content_id is not null;

-- Posée à la création, ensuite seulement retirable : aucun cycle possible. Le
-- même refus pour « absent » et « autre marque » : il ne doit pas servir à
-- deviner l'existence d'un contenu ailleurs.
create or replace function public.contents_check_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_content_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.source_content_id is distinct from old.source_content_id then
    raise exception 'source_locked';
  end if;

  if not exists (
    select 1 from public.contents p
    where p.id = new.source_content_id
      and p.id <> new.id
      and p.brand_id = new.brand_id
      and p.type in ('long_video', 'livestream', 'podcast', 'article')
  ) then
    raise exception 'invalid_source';
  end if;

  return new;
end$$;

revoke all on function public.contents_check_source() from public;

drop trigger if exists contents_check_source_trg on public.contents;
create trigger contents_check_source_trg
  before insert or update of source_content_id, brand_id on public.contents
  for each row execute function public.contents_check_source();

select pg_notify('pgrst', 'reload schema');
