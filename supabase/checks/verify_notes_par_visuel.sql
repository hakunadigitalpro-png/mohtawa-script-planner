-- =====================================================================
-- Contrôle de la migration 0057 — remarques par visuel
--
-- Trois requêtes en LECTURE SEULE. Rien n'est modifié, rien n'est écrit.
-- À coller dans l'éditeur SQL de Supabase après avoir joué `0057`.
--
-- Les trois doivent renvoyer « OK ». Si l'une renvoie autre chose, la
-- migration n'est pas passée en entier : rejoue-la, elle est idempotente.
-- =====================================================================


-- 1) La fonction qui écrit la décision ET les N remarques existe-t-elle,
--    avec la bonne signature et en SECURITY DEFINER ?
select
  case
    when count(*) = 0 then 'MANQUANTE — rejoue 0057'
    when bool_or(p.prosecdef) is not true then 'PRESENTE mais PAS en security definer'
    else 'OK'
  end as resultat,
  count(*) as nb_fonctions,
  string_agg(pg_get_function_identity_arguments(p.oid), ' | ') as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'client_review_content_many';


-- 2) Le déclencheur de notifications sait-il reconnaître un LOT ?
--    Sans ce garde-fou, six remarques envoyées d'un coup produisent six
--    notifications par membre, sur le même contenu.
select
  case
    when p.prosrc like '%kreatly.batch_comments%' then 'OK'
    else 'ANCIENNE VERSION — une notification par remarque, rejoue 0057'
  end as resultat
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'notify_brand_on_comment';


-- 3) Le déclencheur est-il toujours bien accroché à la table ?
--    `create or replace function` ne le détache pas, mais on vérifie :
--    sans lui, plus aucune notification de commentaire ne part.
select
  case when count(*) = 1 then 'OK' else 'TRIGGER ABSENT' end as resultat
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'content_comments'
  and t.tgname = 'content_comments_notify'
  and not t.tgisinternal;
