-- =====================================================================
-- 0058 — Le statut change par un geste, plus par une case cachée
-- Idempotent. À exécuter dans le SQL Editor de Supabase, APRÈS le
-- déploiement du code qui ne lit plus ces colonnes (v99).
--
-- Ce qu'on retire, et pourquoi :
--
--   1. `recompute_content_status` (0015) — l'auto-progression du statut.
--      Elle lisait `reel_details.checklist.script_ready` et `.edited`, que
--      seul l'onglet Checklist écrivait ; cet onglet n'était plus monté.
--      Ses rangs s'arrêtaient à `published` : elle ignorait `approved`,
--      `live`, `pending_review` et tous les statuts des formats simples.
--      Sa seule règle encore vivante (une scène filmée → Tournage) vit
--      maintenant en TypeScript, testée : `lib/content-lifecycle.ts`.
--
--   2. `contents.auto_status` — le verrou de cette RPC. Chaque changement
--      manuel le passait à `false`, ce qui coupait la seule règle utile dès
--      qu'on touchait au statut une fois.
--
--   3. `reel_details.checklist` — le jsonb de l'onglet retiré. Plus
--      personne ne l'écrit ni ne le lit.
--
-- Ce qui reste : `recompute_live_statuses` (0041/0045, le passage en Live
-- à la date), `notify_brand_on_approved` (0046), `content_checklist_items`
-- (les moments à filmer du Vlog, 0027), `submit_for_review` et
-- `client_review_content_many` (0052/0057).
-- =====================================================================

drop function if exists public.recompute_content_status(uuid);

alter table public.contents
  drop column if exists auto_status;

alter table public.reel_details
  drop column if exists checklist;
