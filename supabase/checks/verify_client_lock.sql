-- =====================================================================
-- VÉRIFICATION — « est-ce que le client est vraiment verrouillé ? »
--
-- À coller dans le SQL Editor de Supabase APRÈS avoir exécuté 0052 et 0053.
-- Ne modifie rien : ne fait que lire l'état réel des politiques.
--
-- À relancer après toute nouvelle migration qui touche aux droits : c'est
-- le seul moyen de savoir si une table ajoutée plus tard a été oubliée.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Quelles écritures restent ouvertes à TOUT membre (viewer compris) ?
--
-- RÉSULTAT ATTENDU : uniquement les lignes de `content_comments`.
-- Elles sont normales — commenter est précisément ce qu'un client vient
-- faire, et ces politiques exigent en plus `user_id = auth.uid()`, donc
-- chacun ne touche que ses propres commentaires.
--
-- TOUTE AUTRE LIGNE EST UN TROU : une table où le client peut écrire.
-- ---------------------------------------------------------------------
select
  schemaname          as schema,
  tablename           as "table",
  policyname          as politique,
  cmd                 as operation,
  coalesce(qual, with_check) as predicat
from pg_policies
where cmd in ('INSERT', 'UPDATE', 'DELETE')
  and (qual ilike '%is_brand_member%' or with_check ilike '%is_brand_member%')
order by
  case when tablename = 'content_comments' then 1 else 0 end,  -- les trous en premier
  schemaname, tablename, policyname;


-- ---------------------------------------------------------------------
-- 2) Le contrôle positif : la fonction de rôle existe-t-elle, et
--    combien de politiques s'appuient dessus ?
--
-- RÉSULTAT ATTENDU : `is_brand_writer` présente, et un nombre de
-- politiques bien supérieur à zéro. Si le compte est à 0, c'est que la
-- migration 0052 n'a pas été exécutée.
-- ---------------------------------------------------------------------
select
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_brand_writer')
      as fonction_is_brand_writer_presente,
  (select count(*) from pg_policies
    where qual ilike '%is_brand_writer%' or with_check ilike '%is_brand_writer%')
      as politiques_protegees;


-- ---------------------------------------------------------------------
-- 3) Les fonctions qui contournent la RLS (SECURITY DEFINER) et que
--    n'importe quel compte connecté peut appeler.
--
-- Chacune doit vérifier le rôle elle-même, puisque la RLS ne la protège
-- pas. À relire si une nouvelle apparaît dans cette liste.
--
-- ATTENDUES ici, et correctes : client_review_content (contrôle
-- 'pending_review' et n'écrit que le statut), submit_for_review
-- (is_brand_writer), set_comment_resolved (writer ou auteur depuis 0053),
-- recompute_live_statuses (ne recalcule qu'à partir de dates),
-- add_guest_comment (exige un share_token valide en mode 'comment').
-- ---------------------------------------------------------------------
select
  p.proname as fonction,
  case p.prosecdef when true then 'DEFINER (contourne la RLS)' else 'invoker' end as mode,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
order by p.proname;
