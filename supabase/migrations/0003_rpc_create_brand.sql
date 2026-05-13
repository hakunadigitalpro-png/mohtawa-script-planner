-- =====================================================================
-- 0003 — RPC create_brand(name) en SECURITY DEFINER
-- Contourne les RLS lors de l'insert (sécurité : on vérifie auth.uid()
-- en début de fonction). Crée aussi le membership 'owner'.
-- =====================================================================

create or replace function public.create_brand(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_name     text := btrim(coalesce(p_name, ''));
  v_brand_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if char_length(v_name) = 0 then
    raise exception 'name_required' using errcode = '22023';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'name_too_long' using errcode = '22023';
  end if;

  insert into public.brands (name, created_by)
  values (v_name, v_user_id)
  returning id into v_brand_id;

  -- Le trigger brands_add_owner ajoute déjà le membership.
  -- On le fait quand même ici pour être robuste (no-op si déjà fait).
  insert into public.brand_members (brand_id, user_id, role)
  values (v_brand_id, v_user_id, 'owner')
  on conflict (brand_id, user_id) do nothing;

  return v_brand_id;
end$$;

revoke all on function public.create_brand(text) from public;
grant execute on function public.create_brand(text) to authenticated;
