-- =====================================================================
-- 0014 — Synchronise mark_content_read avec les notifications
--
-- Bug constaté : quand un membre ouvre le drawer de commentaires sur une
-- vidéo, on appelle mark_content_read(content_id) qui pousse
-- content_reads.last_comment_read_at = now(). Mais les notifications
-- créées par le trigger de la migration 0013 restent flag read=false,
-- donc le badge sur la cloche ne diminue pas.
--
-- Fix : on étend mark_content_read pour aussi marquer comme lues les
-- notifications de cette vidéo, pour le user courant.
--
-- Idempotent (CREATE OR REPLACE). À exécuter dans le SQL Editor.
-- =====================================================================

create or replace function public.mark_content_read(p_content_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  -- 1) Met à jour le marqueur "j'ai vu tous les commentaires antérieurs"
  insert into public.content_reads (user_id, content_id, last_comment_read_at)
  values (auth.uid(), p_content_id, now())
  on conflict (user_id, content_id)
  do update set last_comment_read_at = excluded.last_comment_read_at;

  -- 2) Marque comme lues les notifications de ce content pour ce user
  -- (table introduite par 0013_notifications.sql)
  update public.notifications
  set read = true
  where user_id = auth.uid()
    and content_id = p_content_id
    and read = false;
end$$;

revoke all on function public.mark_content_read(uuid) from public;
grant execute on function public.mark_content_read(uuid) to authenticated;
