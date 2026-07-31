# Wishlist Mohtawa — features parkées

Fonctionnalités **construites mais volontairement masquées de l'interface** pour
recentrer l'app sur l'essentiel (planification : Plan · Script · Storyboard ·
Checklist · Calendrier · Piliers). Le code reste dans le repo — rien n'est
supprimé. On y reviendra plus tard.

Décision : 2026-07-24.

---

## 1. Autopsie IA d'une vidéo publiée

**Ce que ça fait :** dans l'onglet Performance, coller le transcript + des
captures d'insights → Claude croise le wording avec les stats et explique
pourquoi la vidéo a marché ou raté (autopsie).

**Pourquoi parké :** feature lourde (vision + long prompt), pas prioritaire tant
que la base de planification n'est pas 100 % au point.

**Où c'est masqué :**
- `components/content-detail/performance-tab.tsx` — import + rendu de
  `<VideoAutopsy>` retirés (commentaire en place).

**Code conservé (intact) :**
- `components/content-detail/video-autopsy.tsx`
- `generateVideoAutopsy` dans `app/(app)/contents/ai-actions.ts`
- `generateAutopsy` dans `lib/ai.ts`
- Colonnes DB `performances.transcript / autopsy_md / autopsy_at /
  insights_image_urls` (migrations 0022-0024) — laissées telles quelles.

**Pour réactiver :** remettre l'import et le bloc `<VideoAutopsy .../>` dans
`performance-tab.tsx` (voir le commentaire à l'emplacement d'origine).

---

## 2. « T'inspirer d'une vidéo qui marche » (transcription)

**Ce que ça fait :** en haut de l'onglet Script, importer une vidéo → Groq la
transcrit (Whisper) → Claude décortique le wording et propose un script.

**Pourquoi parké :** double dépendance externe (Groq + Claude) + l'entrée
idéale reste « coller un lien » (récupérateur non-officiel = fragile). À
retravailler à froid.

**Où c'est masqué :**
- `components/content-detail/script-tab.tsx` — import + rendu de
  `<ReferenceAnalyzer>` retirés (commentaire en place).

**Code conservé (intact) :**
- `components/content-detail/reference-analyzer.tsx`
- `analyzeReferenceVideoAction` dans `app/(app)/contents/ai-actions.ts`
- `transcribeWithGroq` + `analyzeReferenceVideo` dans `lib/ai.ts`

**Pour réactiver :** remettre l'import et `<ReferenceAnalyzer contentId={contentId} />`
en haut du `return` de `ReelScript` dans `script-tab.tsx`.

---

## 3. Coller un lien Instagram/TikTok → transcript (jamais construit)

**Idée :** coller un lien de vidéo (pas d'upload) → récupérer la vidéo →
transcrire → analyser. **Bloqueur honnête :** aucune API officielle ne donne le
transcript ; il faut un récupérateur non-officiel (tikwm pour TikTok sans clé ;
Instagram nécessite une clé type RapidAPI). Fragile pour un produit vendu.
À décider plus tard (dépend du point 2).

---

## 4. Passer l'IA de Claude à Gemini (coût + carte)

**Idée :** basculer les appels IA de Mohtawa (assistant de thèmes, génération
reel/story/vlog) de Claude vers **Google Gemini**.

**Pourquoi :**
- **Beaucoup moins cher** (par million de tokens, entrée/sortie) :
  - Gemini Flash-Lite ≈ 0,10 $ / 0,40 $ · Gemini Flash ≈ 1,50 $ / 7,50 $
  - vs Claude Haiku 1 $ / 5 $ · Sonnet 3 $ / 15 $ · Opus 5 $ / 25 $
  → Flash-Lite ≈ **10× moins cher que Haiku, 30× moins que Sonnet**.
- **Tier GRATUIT sans carte** (Google AI Studio, compte
  hakuna.digitalpro) : ~1 500 requêtes/jour sur Flash/Flash-Lite → règle le
  problème de carte (comme Groq) et peut coûter 0 € en bêta.

**Réserves / à valider :**
- **Qualité FR + dialecte tunisien** : Gemini Flash est correct mais Claude
  est meilleur — à tester sur nos vrais prompts (assistant de thèmes, hooks
  tunisiens) avant de basculer.
- **Travail de bascule modéré** : réécrire les appels dans `lib/ai.ts`. Gemini
  a un **endpoint compatible OpenAI**, donc on réutilise la forme de code déjà
  écrite pour Groq/OpenAI. Nouvelle clé gratuite à créer sur Google AI Studio.

**Piste d'archi :** garder Claude pour le premium (analyses fines) et passer
la génération à gros volume sur Gemini Flash gratuit. Commencer par
l'assistant de thèmes pour comparer la qualité en conditions réelles.

## 5. Génération d'IMAGE de scène (DALL-E) — retirée de l'UI

**Ce que ça faisait :** dans le Storyboard, un bouton « Générer une image IA »
créait un sketch de scène via DALL-E (OpenAI).

**Pourquoi retiré :** Claude ne génère pas d'images, et OpenAI est inaccessible
(carte refusée). Bouton mort → retiré du Storyboard.

**Code conservé (intact) :** `generateSceneImage` (lib/ai.ts),
`aiGenerateSceneImage` (ai-actions.ts).

**Pour réactiver un jour :** brancher un fournisseur d'images qui accepte sa
carte (ex : image via un modèle Gemini/Imagen, ou un service tiers), puis
remettre le bouton + le dialog dans `storyboard-tab.tsx`. Toute la génération
de TEXTE (script Reel, Story, thèmes, vlog, autopsie) tourne désormais sur
**Claude** — plus aucune dépendance OpenAI pour le texte.

## Autres idées en attente (déjà notées dans CLAUDE.md / mémoire)

- Vrai `.apk` Android (TWA) via build cloud — PWABuilder avait échoué.
- Objectif du pilier affiché aussi sur la vue partagée + le PDF.
- Passe lisibilité (texte plus grand, orange maîtrisé) sur l'éditeur de
  contenu et le dashboard/analytics.
