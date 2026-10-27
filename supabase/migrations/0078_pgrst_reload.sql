-- Petit coup de pousse à PostgREST pour qu'il relise la nouvelle
-- signature de `list_brand_members_with_emails` (ajout de la colonne
-- `scopes` dans 0077). Sans ça son cache gardait l'ancienne shape et
-- la liste des membres remontait vide côté UI.
select pg_notify('pgrst', 'reload schema');
