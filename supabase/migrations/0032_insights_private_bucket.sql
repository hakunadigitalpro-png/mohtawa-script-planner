-- =====================================================================
-- 0032 — Bucket PRIVÉ `insights` pour les captures d'autopsie
--
-- Les captures d'insights (courbe de rétention, vues, portée, revenus…)
-- contiennent des données SENSIBLES du client. Le bucket `content-media`
-- étant public, ces images étaient téléchargeables par quiconque avec l'URL.
--
-- On les isole dans un bucket PRIVÉ dédié : lecture/écriture réservées aux
-- membres de la marque, et affichage via URL signée temporaire côté serveur
-- (jamais d'URL publique permanente). Le bucket `content-media` (logos,
-- storyboards, stories affichés sur les liens de partage publics) reste
-- inchangé.
--
-- Chemin de fichier : {content_id}/{uuid}.{ext} (même convention que
-- content-media → on réutilise le check d'appartenance via `contents`).
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('insights', 'insights', false)
on conflict (id) do update set public = false;

-- SELECT : membre de la marque du contenu (nécessaire pour générer une URL
-- signée — un bucket privé n'a pas de lecture publique).
drop policy if exists "insights_select" on storage.objects;
create policy "insights_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'insights'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_member(c.brand_id)
    )
  );

-- INSERT : membre de la marque du contenu.
drop policy if exists "insights_insert" on storage.objects;
create policy "insights_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'insights'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_member(c.brand_id)
    )
  );

-- UPDATE : membre de la marque du contenu.
drop policy if exists "insights_update" on storage.objects;
create policy "insights_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'insights'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_member(c.brand_id)
    )
  );

-- DELETE : membre de la marque du contenu.
drop policy if exists "insights_delete" on storage.objects;
create policy "insights_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'insights'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_member(c.brand_id)
    )
  );
