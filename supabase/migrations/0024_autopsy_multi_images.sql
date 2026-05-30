-- =====================================================================
-- 0024 — Autopsie : plusieurs captures d'insights
--
-- L'utilisateur veut uploader PLUSIEURS captures (courbe de rétention,
-- stats, portée, source de trafic...). Claude (multimodal) les lit toutes
-- et en extrait tout : courbe, vue moyenne, durée, label, chiffres. Du
-- coup on retire les champs manuels (durée / vue moyenne / label) — tout
-- vient des images.
--
-- On passe de la colonne unique insights_image_url à un tableau
-- insights_image_urls. On backfill depuis l'ancienne.
--
-- Idempotent.
-- =====================================================================

alter table public.performances
  add column if not exists insights_image_urls text[] not null default '{}';

-- Backfill depuis la colonne unique (migration 0023) si présente
update public.performances
set insights_image_urls = array[insights_image_url]
where insights_image_url is not null
  and insights_image_url <> ''
  and (insights_image_urls is null or array_length(insights_image_urls, 1) is null);

-- Les colonnes 0023 (insights_image_url, avg_watch_seconds,
-- video_duration_seconds, performance_label) restent en place mais ne
-- sont plus utilisées par l'UI — on ne les drop pas pour rester safe.
