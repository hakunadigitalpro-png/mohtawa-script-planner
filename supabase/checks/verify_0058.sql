-- Vérification de 0058 — à coller dans le SQL Editor après la migration.
-- Attendu : trois lignes, toutes à "OK".

select 'recompute_content_status retirée' as verification,
       case when not exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'recompute_content_status'
       ) then 'OK' else 'KO : la fonction existe encore' end as resultat
union all
select 'contents.auto_status retirée',
       case when not exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'contents'
           and column_name = 'auto_status'
       ) then 'OK' else 'KO : la colonne existe encore' end
union all
select 'reel_details.checklist retirée',
       case when not exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'reel_details'
           and column_name = 'checklist'
       ) then 'OK' else 'KO : la colonne existe encore' end
union all
select 'recompute_live_statuses toujours là',
       case when exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'recompute_live_statuses'
       ) then 'OK' else 'KO : le passage en Live à la date a disparu' end;
