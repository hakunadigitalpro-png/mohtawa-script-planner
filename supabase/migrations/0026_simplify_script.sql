-- =====================================================================
-- 0026 — Simplification du script : Accroche / Corps / Outro
--
-- Choix produit : le script passe de 7 blocs (intro, point1-3, transition,
-- recap, outro + script_full) à 3 blocs simples affichés :
--   Accroche → reel_details.intro
--   Corps    → reel_details.script_full
--   Outro    → reel_details.outro
--
-- Les colonnes point1-3 / transition / recap RESTENT en base (rien n'est
-- supprimé), mais ne sont plus affichées. Pour ne pas "perdre" le contenu
-- déjà saisi, on le replie dans `script_full` (le nouveau "Corps") UNIQUEMENT
-- quand script_full est vide (on n'écrase jamais un corps déjà rempli).
--
-- Non destructif + idempotent (rejouable : la 2e fois, script_full n'est
-- plus vide donc rien ne se repasse).
-- =====================================================================

update public.reel_details
set script_full = trim(both E'\n' from concat_ws(
      E'\n\n',
      nullif(trim(coalesce(point1, '')), ''),
      nullif(trim(coalesce(point2, '')), ''),
      nullif(trim(coalesce(point3, '')), ''),
      nullif(trim(coalesce(transition, '')), ''),
      nullif(trim(coalesce(recap, '')), '')
    ))
where coalesce(trim(script_full), '') = ''
  and (
      coalesce(trim(point1), '') <> '' or
      coalesce(trim(point2), '') <> '' or
      coalesce(trim(point3), '') <> '' or
      coalesce(trim(transition), '') <> '' or
      coalesce(trim(recap), '') <> ''
  );
