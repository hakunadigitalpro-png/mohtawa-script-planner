-- =====================================================================
-- 0057 — Une remarque PAR VISUEL, et un lot = un seul événement
--
-- Jusqu'ici le client ne pouvait laisser qu'UNE remarque, rattachée à UNE
-- diapo (`client_review_content`, 0052). Sur un carrousel de dix visuels
-- c'est intenable : « le titre de la 1 est trop long » et « la couleur de
-- la 4 n'est pas la charte » devaient tenir dans la même phrase.
--
-- Deux choses ici :
--   1) le trigger de notification apprend à reconnaître un LOT, pour ne pas
--      sonner six fois pour un seul passage du client ;
--   2) `client_review_content_many` écrit la décision ET les N remarques
--      dans la même transaction.
--
-- Idempotent : rejouable sans dommage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Le trigger de notification (remplace celui de 0013)
--
-- Il insère une ligne par membre de la marque ET par commentaire. Six
-- remarques déposées d'un coup donnaient donc six notifications à chaque
-- membre, sur le même contenu — une cloche à douze qui se lit comme un
-- reproche, alors qu'il s'est passé UNE chose : le client a répondu.
--
-- La RPC ci-dessous pose un drapeau le temps d'écrire son lot, et insère
-- elle-même la notification unique. Tout autre commentaire (l'équipe qui
-- répond, un invité) continue de notifier comme avant.
-- ---------------------------------------------------------------------
create or replace function public.notify_brand_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
begin
  if coalesce(current_setting('kreatly.batch_comments', true), '') = '1' then
    return new;
  end if;

  select brand_id into v_brand_id
  from public.contents
  where id = new.content_id;

  if v_brand_id is null then
    return new;
  end if;

  insert into public.notifications (user_id, content_id, comment_id, type)
  select m.user_id, new.content_id, new.id, 'comment'
  from public.brand_members m
  where m.brand_id = v_brand_id
    and (new.user_id is null or m.user_id <> new.user_id);

  return new;
end$$;

-- ---------------------------------------------------------------------
-- 2) client_review_content_many
--
-- Pourquoi une RPC plutôt que N insert depuis l'application : ce n'est PAS
-- une question de droits — `comments_insert_members` (0009) autorise bien
-- un client à écrire ses commentaires, la 0052 l'a laissé exprès. C'est une
-- question d'ATOMICITÉ, et c'est l'invariant que la 0052 pose déjà : un
-- « je demande une modif' » sans la remarque qui l'explique ne doit jamais
-- pouvoir exister. Statut et remarques tombent ensemble, ou pas du tout.
--
-- `p_notes` : [{"media_id": "<uuid>|null", "body": "..."}]
--   media_id null → la remarque porte sur l'ensemble (target 'plan'/'general').
--
-- Les remarques partent avec les DEUX décisions. Un client qui valide en
-- disant « parfait, juste la 3 est ma préférée » n'a pas à choisir entre se
-- taire et demander une modification qu'il ne veut pas.
-- ---------------------------------------------------------------------
create or replace function public.client_review_content_many(
  p_content_id uuid,
  p_decision   text,                        -- 'approve' | 'revise'
  p_notes      jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_status   text;
  v_note     jsonb;
  v_body     text;
  v_media    uuid;
  v_kept     int  := 0;
  v_first    uuid := null;
  v_new      uuid;
begin
  if p_decision not in ('approve', 'revise') then
    raise exception 'Invalid decision';
  end if;

  select brand_id, status into v_brand_id, v_status
  from public.contents
  where id = p_content_id;

  if v_brand_id is null then
    raise exception 'not_found';
  end if;

  -- Tout membre, pas seulement le client : l'équipe relit parfois avant lui.
  if not public.is_brand_member(v_brand_id) then
    raise exception 'Forbidden';
  end if;

  if v_status <> 'pending_review' then
    raise exception 'not_pending';
  end if;

  -- On valide TOUT avant d'écrire quoi que ce soit. `client_review_content`
  -- accepte `p_target_type`/`p_target_id` en texte libre : un appelant direct
  -- peut y ancrer sa remarque sur n'importe quoi. On ne reproduit pas ce trou
  -- N fois — ici chaque cible doit être un visuel DE CE CONTENU.
  for v_note in select * from jsonb_array_elements(coalesce(p_notes, '[]'::jsonb))
  loop
    v_body := nullif(btrim(coalesce(v_note ->> 'body', '')), '');
    if v_body is null then
      continue;
    end if;

    v_media := nullif(v_note ->> 'media_id', '')::uuid;
    if v_media is not null and not exists (
      select 1 from public.content_media m
      where m.id = v_media and m.content_id = p_content_id
    ) then
      raise exception 'invalid_media';
    end if;

    v_kept := v_kept + 1;
  end loop;

  if p_decision = 'revise' and v_kept = 0 then
    raise exception 'empty_revision';
  end if;

  if p_decision = 'approve' then
    update public.contents
    set status      = 'approved',
        approved_by = auth.uid(),
        approved_at = now()
    where id = p_content_id;
  else
    update public.contents
    set status      = 'needs_revision',
        approved_by = null,
        approved_at = null
    where id = p_content_id;
  end if;

  -- Le drapeau : le trigger laisse passer, on notifiera une seule fois.
  perform set_config('kreatly.batch_comments', '1', true);

  for v_note in select * from jsonb_array_elements(coalesce(p_notes, '[]'::jsonb))
  loop
    v_body := nullif(btrim(coalesce(v_note ->> 'body', '')), '');
    if v_body is null then
      continue;
    end if;
    v_media := nullif(v_note ->> 'media_id', '')::uuid;

    insert into public.content_comments (
      content_id, target_type, target_id, user_id, body
    ) values (
      p_content_id,
      case when v_media is null then 'plan' else 'media' end,
      case when v_media is null then 'general' else v_media::text end,
      auth.uid(),
      left(v_body, 2000)
    )
    returning id into v_new;

    if v_first is null then
      v_first := v_new;
    end if;
  end loop;

  perform set_config('kreatly.batch_comments', '', true);

  -- UNE notification, qui pointe la première remarque : la cloche dit « ton
  -- client a répondu », pas « ton client a écrit, écrit, écrit, écrit ».
  if v_first is not null then
    insert into public.notifications (user_id, content_id, comment_id, type)
    select m.user_id, p_content_id, v_first, 'comment'
    from public.brand_members m
    where m.brand_id = v_brand_id
      and m.user_id is distinct from auth.uid();
  end if;
end$$;

revoke all on function public.client_review_content_many(uuid, text, jsonb) from public;
grant execute on function public.client_review_content_many(uuid, text, jsonb) to authenticated;
