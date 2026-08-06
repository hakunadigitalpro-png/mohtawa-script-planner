-- =====================================================================
-- 0044 — Commentaires récents à l'échelle de la marque
--
-- list_content_comments_with_authors (migration 0009/0012) est scopée à
-- UN contenu. Pour la mini-carte "Commentaires" du Dashboard (voir maquette
-- validée), il faut les derniers commentaires de TOUTE la marque, avec
-- l'auteur — même pattern (SECURITY DEFINER pour lire auth.users).
--
-- Idempotent.
-- =====================================================================

create or replace function public.list_recent_brand_comments(
  p_brand_id uuid,
  p_limit    int default 5
)
returns table (
  id            uuid,
  content_id    uuid,
  content_title text,
  user_id       uuid,
  author_email  text,
  guest_name    text,
  is_guest      boolean,
  body          text,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_brand_member(p_brand_id) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    cc.id, cc.content_id, c.title as content_title,
    cc.user_id, u.email::text as author_email,
    cc.guest_name, cc.is_guest,
    cc.body, cc.created_at
  from public.content_comments cc
  join public.contents c on c.id = cc.content_id
  left join auth.users u on u.id = cc.user_id
  where c.brand_id = p_brand_id
  order by cc.created_at desc
  limit p_limit;
end$$;

revoke all on function public.list_recent_brand_comments(uuid, int) from public;
grant execute on function public.list_recent_brand_comments(uuid, int) to authenticated;
