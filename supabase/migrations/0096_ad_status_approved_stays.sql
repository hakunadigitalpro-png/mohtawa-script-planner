-- Corrige 0095 avant toute mise en service : « Validée » ne passe plus seule à
-- « En cours ». Validée veut dire que le client est d'accord, pas que la campagne
-- tourne chez Meta : le client aurait vu « En cours » sur une campagne pas lancée,
-- et la remettre en Validée aurait été impossible, le calcul la rebasculant à
-- chaque affichage. Même règle que les contenus : un contenu validé n'est jamais
-- mis en ligne tout seul.
--
-- Restent automatiques : Programmée (anciennes campagnes) → En cours à la date,
-- et En cours → Terminée une fois la période finie.

create or replace function public.recompute_ad_statuses(p_brand_id uuid)
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

  update public.ad_campaigns
  set status = 'live'
  where brand_id = p_brand_id
    and status = 'scheduled'
    and date_start is not null
    and date_start <= current_date
    and (date_end is null or date_end >= current_date);

  update public.ad_campaigns
  set status = 'completed'
  where brand_id = p_brand_id
    and status = 'live'
    and date_end is not null
    and date_end < current_date;

  perform set_config('kreatly.system_change', '', true);
end$$;

revoke all on function public.recompute_ad_statuses(uuid) from public;
grant execute on function public.recompute_ad_statuses(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
