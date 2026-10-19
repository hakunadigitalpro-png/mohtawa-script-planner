-- Rend `gen_random_bytes()` (de l'extension `pgcrypto`) visible depuis
-- les fonctions `SECURITY DEFINER` qui l'appellent sans qualifier le
-- schéma — `create_brand_invitation` (0008) et `enable_content_sharing`
-- (0005). Sur Supabase Cloud, `extensions` était d'office dans le
-- `search_path` ; sur notre Supabase auto-hébergé il faut l'ajouter.
--
-- On s'assure d'abord que l'extension existe (dans n'importe quel
-- schéma), puis on force `search_path = public, extensions` sur les
-- deux fonctions. Idempotent.

create extension if not exists pgcrypto with schema extensions;

alter function public.create_brand_invitation(uuid, public.brand_role, text)
  set search_path = public, extensions;

alter function public.enable_content_sharing(uuid)
  set search_path = public, extensions;
