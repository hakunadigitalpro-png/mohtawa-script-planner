-- Rattrapage ponctuel après le changement de règle « lu = répondu »
-- (commit a3472c7). Avant ce changement, ouvrir un fil marquait le
-- contenu comme lu : Mariam avait ouvert les fils de DIMPO la veille,
-- donc les 6 remarques du client étaient déjà « lues » et les pastilles
-- restaient à 0. On remet à zéro ses marqueurs de lecture sur les
-- contenus DIMPO où la DERNIÈRE remarque n'est pas d'elle — ceux où
-- une réponse est attendue. Les contenus où elle a déjà répondu en
-- dernier ne bougent pas.
--
-- Périmètre : un seul user (hakuna.digitalpro@gmail.com), une seule
-- marque (DIMPO). Idempotent : une seconde exécution ne trouve rien.

do $$
declare
  v_user  uuid;
  v_brand uuid;
  v_before int;
  v_after  int;
  r record;
begin
  select id into v_user  from auth.users where email = 'hakuna.digitalpro@gmail.com';
  select id into v_brand from public.brands where name = 'DIMPO' limit 1;

  -- État avant : contenus DIMPO avec des remarques d'autrui non lues.
  select count(*) into v_before from (
    select c.id
    from public.contents c
    join public.content_comments cc on cc.content_id = c.id and cc.user_id <> v_user
    left join public.content_reads cr on cr.content_id = c.id and cr.user_id = v_user
    where c.brand_id = v_brand
      and cc.created_at > coalesce(cr.last_comment_read_at, '1970-01-01'::timestamptz)
    group by c.id
  ) s;
  raise notice 'Contenus DIMPO signalés non-lus AVANT : %', v_before;

  -- Reset : on supprime le marqueur de lecture sur les contenus où la
  -- dernière remarque vient de quelqu'un d'autre.
  for r in
    select c.id, c.title
    from public.contents c
    where c.brand_id = v_brand
      and exists (select 1 from public.content_comments x where x.content_id = c.id)
      and (
        select x.user_id from public.content_comments x
        where x.content_id = c.id
        order by x.created_at desc limit 1
      ) <> v_user
      and exists (
        select 1 from public.content_reads cr2
        where cr2.content_id = c.id and cr2.user_id = v_user
      )
  loop
    delete from public.content_reads
    where content_id = r.id and user_id = v_user;
    raise notice '  reset lecture : %', r.title;
  end loop;

  select count(*) into v_after from (
    select c.id
    from public.contents c
    join public.content_comments cc on cc.content_id = c.id and cc.user_id <> v_user
    left join public.content_reads cr on cr.content_id = c.id and cr.user_id = v_user
    where c.brand_id = v_brand
      and cc.created_at > coalesce(cr.last_comment_read_at, '1970-01-01'::timestamptz)
    group by c.id
  ) s;
  raise notice 'Contenus DIMPO signalés non-lus APRÈS : %', v_after;
end$$;
