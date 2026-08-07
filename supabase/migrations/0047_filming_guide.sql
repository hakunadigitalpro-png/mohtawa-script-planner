-- =====================================================================
-- 0047 — Guide de tournage IA (Reel)
--
-- Le générateur IA du script (bouton "Générer avec l'IA") peut désormais,
-- si l'utilisatrice coche la case, découper le script en scènes de
-- storyboard tournage-prêtes : cadrage caméra (déjà existant), + expression
-- faciale et mouvement/gestuelle (nouveau). Plus un petit résumé global
-- (éclairage, style caméra, rythme, énergie, conseil pro) stocké sur
-- reel_details.
--
-- Reel uniquement — Story (story_slides) et Vlog (vlog_details + capture
-- checklist) ont des modèles différents, pas de storyboard scène par scène.
--
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

alter table public.storyboard_scenes
  add column if not exists expression text,
  add column if not exists movement text;

alter table public.reel_details
  add column if not exists filming_guide jsonb;
