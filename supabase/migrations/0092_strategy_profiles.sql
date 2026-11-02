-- Studio de marque : les profils Instagram / LinkedIn optimisés par l'IA
-- vivent à côté de la stratégie dont ils découlent, un objet par réseau
-- ({ "instagram": {...}, "linkedin": {...} }). Les policies existantes de
-- brand_strategies couvrent déjà la lecture et l'écriture.

alter table public.brand_strategies
  add column if not exists profiles jsonb;

select pg_notify('pgrst', 'reload schema');
