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

## Autres idées en attente (déjà notées dans CLAUDE.md / mémoire)

- Vrai `.apk` Android (TWA) via build cloud — PWABuilder avait échoué.
- Objectif du pilier affiché aussi sur la vue partagée + le PDF.
- Passe lisibilité (texte plus grand, orange maîtrisé) sur l'éditeur de
  contenu et le dashboard/analytics.
