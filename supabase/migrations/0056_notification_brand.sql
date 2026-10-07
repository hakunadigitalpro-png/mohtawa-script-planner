-- =====================================================================
-- 0056 — La marque d'une notification
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
--
-- Les notifications sont personnelles, donc elles arrivent de TOUTES les
-- marques dont on est membre. Rien ne le disait, et cliquer l'une d'elles
-- ouvrait un contenu d'une autre marque sans changer la marque active.
--
-- Ce n'était pas qu'une confusion d'affichage : le rôle, l'interrupteur
-- d'écriture assistée et la navigation « contenu précédent / suivant »
-- restaient ceux de l'ancienne marque, donc faux pour ce contenu-là.
--
-- On ajoute la marque au retour, pour que l'application puisse l'annoncer
-- et basculer dessus.
-- =====================================================================

drop function if exists public.list_my_notifications(int);

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
  is_guest            boolean,
  brand_id            uuid,
  brand_name          text
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
    (cc.user_id is null) as is_guest,
    c.brand_id           as brand_id,
    b.name               as brand_name
  from public.notifications n
  left join public.contents c           on c.id  = n.content_id
  left join public.brands b             on b.id  = c.brand_id
  left join public.content_comments cc  on cc.id = n.comment_id
  left join auth.users u                on u.id  = cc.user_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit p_limit;
end$$;

revoke all on function public.list_my_notifications(int) from public;
grant execute on function public.list_my_notifications(int) to authenticated;
