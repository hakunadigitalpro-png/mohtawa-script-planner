-- =====================================================================
-- 0046 — Notification "contenu validé mais pas encore programmé"
--
-- Réutilise la table `notifications` (migration 0013, déjà utilisée pour
-- les commentaires) avec un nouveau type. Dès qu'un contenu (n'importe
-- quel format — la migration 0045 a aligné le vocabulaire vidéo dessus)
-- passe au statut "Validé" (approved), tous les membres de la marque SAUF
-- les clients (rôle viewer) et l'auteur du changement reçoivent une
-- notification. Elle se marque lue toute seule dès que le contenu quitte
-- "Validé" (programmé, remis en révision, etc.) — pas besoin d'action
-- manuelle, dans le même esprit "guide" que le reste de l'app.
--
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

-- 1) Élargit le type autorisé sur notifications ------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('comment', 'ready_to_schedule'));

-- 2) Trigger : crée / efface la notif selon la transition de statut -----
create or replace function public.notify_brand_on_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Entrée dans "approved" → notifie l'équipe (pas les viewers, pas
  -- l'auteur du changement lui-même).
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into public.notifications (user_id, content_id, type)
    select m.user_id, new.id, 'ready_to_schedule'
    from public.brand_members m
    where m.brand_id = new.brand_id
      and m.role <> 'viewer'
      and (auth.uid() is null or m.user_id <> auth.uid());
  end if;

  -- Sortie de "approved" (programmé, remis en révision…) → la notif n'a
  -- plus lieu d'être : on la marque lue toute seule.
  if old.status = 'approved' and (new.status is distinct from 'approved') then
    update public.notifications
    set read = true
    where content_id = new.id
      and type = 'ready_to_schedule'
      and read = false;
  end if;

  return new;
end$$;

drop trigger if exists contents_notify_approved on public.contents;
create trigger contents_notify_approved
  after update of status on public.contents
  for each row execute function public.notify_brand_on_approved();
