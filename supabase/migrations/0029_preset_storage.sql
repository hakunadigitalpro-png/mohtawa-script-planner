-- =====================================================================
-- 0029 — Images de setups au niveau MARQUE.
--
-- Les setups de tournage (brand_scene_presets) peuvent maintenant porter une
-- photo de référence créée DEPUIS la marque (pas seulement depuis une vidéo).
-- Le stockage vidéo reste sous {content_id}/…  ; les images de setups marque
-- vivent sous  presets/{brand_id}/…  dans le même bucket public content-media.
--
-- On ajoute des policies PERMISSIVES supplémentaires (combinées en OR avec
-- celles de 0004) : insert/delete autorisés si le 2e segment du chemin est
-- une marque dont l'utilisateur est membre.
-- Idempotent. SELECT reste public (bucket public).
-- =====================================================================

drop policy if exists "content_media_preset_insert" on storage.objects;
create policy "content_media_preset_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'presets'
    and public.is_brand_member(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "content_media_preset_delete" on storage.objects;
create policy "content_media_preset_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = 'presets'
    and public.is_brand_member(((storage.foldername(name))[2])::uuid)
  );
