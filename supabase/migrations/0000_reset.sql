-- =====================================================================
-- RESET — vide tout l'ancien schéma applicatif avant d'appliquer 0001.
-- À EXÉCUTER UNE SEULE FOIS, AVANT 0001_initial.sql.
-- ATTENTION : supprime toutes les données des tables ci-dessous.
-- =====================================================================

drop table if exists public.performances        cascade;
drop table if exists public.storyboard_scenes   cascade;
drop table if exists public.story_details       cascade;
drop table if exists public.reel_details        cascade;
drop table if exists public.contents            cascade;
drop table if exists public.brand_members       cascade;
drop table if exists public.brands              cascade;

drop type  if exists public.brand_role          cascade;

drop function if exists public.is_brand_member(uuid)          cascade;
drop function if exists public.add_brand_creator_as_owner()   cascade;
drop function if exists public.set_updated_at()               cascade;
