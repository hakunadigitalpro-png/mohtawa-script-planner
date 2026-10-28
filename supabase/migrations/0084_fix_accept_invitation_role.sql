-- Correction : accept_brand_invitation ne mettait à jour que
-- `expires_at` quand l'user était déjà membre, pas le `role`. Donc
-- une nouvelle invitation en Éditeur acceptée par un ancien viewer
-- ne changeait pas son rôle — il restait viewer et voyait toujours
-- la sidebar réduite.
--
-- Nouveau comportement : la nouvelle invitation ÉCRASE le rôle du
-- membership existant (si on invite à nouveau en Éditeur, c'est qu'on
-- veut le promouvoir ; une invitation en viewer d'un ancien admin
-- rétrograderait, à ne pas faire par erreur — mais c'est le choix
-- explicite de celui qui invite). Les scopes personnalisés sont
-- RESET à NULL (= défaut rôle) pour éviter que d'anciens scopes
-- restreints ne restent appliqués à un nouveau rôle élargi.

create or replace function public.accept_brand_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.brand_invitations
  where token = p_token
  limit 1;

  if not found then
    raise exception 'Invitation introuvable';
  end if;

  if v_row.used_at is not null then
    raise exception 'Invitation déjà utilisée';
  end if;

  if v_row.expires_at < now() then
    raise exception 'Invitation expirée';
  end if;

  v_expires := case
    when v_row.member_expires_days is not null
      then now() + make_interval(days => v_row.member_expires_days)
    else null
  end;

  insert into public.brand_members (brand_id, user_id, role, expires_at, scopes)
  values (v_row.brand_id, auth.uid(), v_row.role, v_expires, null)
  on conflict (brand_id, user_id) do update
    set role       = excluded.role,
        expires_at = excluded.expires_at,
        scopes     = null;

  update public.brand_invitations
  set used_at = now(),
      used_by = auth.uid()
  where id = v_row.id;

  return jsonb_build_object(
    'brand_id',   v_row.brand_id,
    'role',       v_row.role,
    'expires_at', v_expires
  );
end$$;

-- Rattrapage pour le cas concret de Mariam : son testeur
-- mariam.benaissa91@gmail.com a été réinvité en Éditeur mais est resté
-- viewer. On le promeut maintenant ; les scopes restent null pour que
-- le défaut rôle (editor = tout sauf Marque et Équipe) s'applique.
update public.brand_members m
set role = 'editor', scopes = null
from public.brand_invitations i
where i.id = '9d5d9ae8-d69f-4858-b883-30d2959824cc'
  and m.brand_id = i.brand_id
  and m.user_id = i.used_by;

select pg_notify('pgrst', 'reload schema');
