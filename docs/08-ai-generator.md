# Spec 08 — AI Script Generator

## Vue d'ensemble

Génère automatiquement un script de Reel ou une séquence de 5 stories à partir d'un sujet. Modèle : **OpenAI `gpt-4o-mini`**.

## Architecture

```
┌──────────────────────┐
│ <AiGeneratorButton>  │  client component sur ScriptTab
└──────────┬───────────┘
           │ open modal
┌──────────▼───────────┐
│ <AiGeneratorModal>   │  collecte topic + audience
└──────────┬───────────┘
           │ submit "Générer"
┌──────────▼───────────┐
│ ai-actions.ts        │  "use server"
│ aiGenerateReel() OU  │
│ aiGenerateStory()    │
└──────────┬───────────┘
           │ apply=false → preview
           │ apply=true  → persist
┌──────────▼───────────┐
│ lib/ai.ts            │  fetch OpenAI
│ generateJSON({...})  │
└──────────┬───────────┘
           │
           ▼
   api.openai.com/v1/chat/completions
   { model: 'gpt-4o-mini', response_format: json_object, ... }
```

## Configuration

### Env var requise

```
OPENAI_API_KEY=sk-...
```

À mettre dans :
- `.env.local` pour le dev
- Vercel → Project Settings → Environment Variables (Production / Preview / Development)

### Coût opérateur

- `gpt-4o-mini` : ~$0.15 / 1M input tokens, ~$0.60 / 1M output tokens
- 1 génération typique : ~400 input + 400 output tokens = ~$0.0004
- 1000 générations ≈ $0.40

**Setup recommandé sur OpenAI** :
- Ajout d'une **Hard limit** mensuelle (ex: $5) dans le dashboard Billing
- Permet de capper les coûts en cas d'abuse ou de bug

## Prompts

### Reel

System :
```
Tu es un expert en contenu vidéo viral pour les réseaux sociaux. Tu écris en français,
dans un ton direct, percutant et orienté valeur. Tu génères des scripts courts qui
arrêtent le scroll. Pas de jargon. Phrases courtes. Une idée par phrase.
```

User (interpolation) :
```
Génère un script de Reel sur le sujet : "{topic}".

Plateforme : {platform || 'Instagram / TikTok'}
Audience cible : {audience || 'créateurs de contenu et entrepreneurs'}

Le script doit faire 30 à 60 secondes lus à voix haute. Phrases courtes, idées
fortes, valeur immédiate.

Retourne UNIQUEMENT un JSON valide (sans backticks, sans markdown) avec cette
structure exacte :
{
  "hook": "...",
  "intro": "...",
  "point1": "...",
  "point2": "...",
  "point3": "...",
  "transition": "...",
  "recap": "...",
  "cta": "...",
  "outro": "..."
}
```

Paramètres OpenAI :
- `temperature: 0.8` (créatif mais cohérent)
- `max_tokens: 800` (suffisant pour le JSON complet)
- `response_format: { type: "json_object" }` (force la sortie JSON valide)

### Story

System :
```
Tu es un expert en stories Instagram/TikTok. Tu écris en français, dans un ton
authentique, engageant et conversationnel. Tu crées des séquences de 5 stories
qui retiennent l'attention jusqu'au CTA.
```

User :
```
Génère une séquence de 5 stories sur le sujet : "{topic}".

Audience cible : {audience}

Structure obligatoire :
- Story 1 : Hook visuel + promesse ou question
- Story 2 : Mise en contexte / révélation
- Story 3 : Le contenu de valeur / exemple
- Story 4 : Conseil clé ou ressource
- Story 5 : Call to action (sticker, swipe up, DM...)

Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "objective": "...",
  "cta_soft": "...",
  "slides": [
    { "slot": 1, "body": "..." },
    ...
  ]
}
```

## Workflow utilisateur

1. Sur la fiche Reel ou Story → onglet Script → bouton "Générer avec l'IA"
2. Modal ouvre :
   - Champ "Sujet de la vidéo" (textarea, required)
   - Champ "Audience cible" (input, optionnel)
3. Clic "Générer" → spinner pendant ~5-10s
4. Preview affiche le JSON formaté (sections labellisées)
5. 3 actions possibles :
   - **Annuler** : ferme la modal, rien n'est appliqué
   - **Régénérer** : relance avec le même sujet (résultat différent grâce à la temperature)
   - **Appliquer au script** : persiste en DB
6. Si "Appliquer" → server action avec `apply: true` :
   - Pour Reel : upsert reel_details (intro/points/transition/recap/outro) + update contents (hook + cta)
   - Pour Story : upsert story_details (objective + cta_soft) + upsert chaque story_slide (body)
7. Modal se ferme, `router.refresh()` → la fiche affiche les nouvelles données

## Gestion d'erreurs

`lib/ai.ts` lève des `AiError` typées :

| Code | Cause | Message FR |
|---|---|---|
| `no_api_key` | OPENAI_API_KEY non set | "L'IA n'est pas configurée. Ajoute OPENAI_API_KEY dans Vercel et redéploie." |
| `auth` | Clé invalide (401) | "Clé OpenAI invalide. Vérifie OPENAI_API_KEY." |
| `rate_limit` | Quota / TPM dépassé (429) | "Trop de requêtes ou quota atteint. Réessaie dans une minute." |
| `network` | Fetch failed | "Impossible de joindre l'IA. Réessaie." |
| `api` | Autre erreur HTTP | "Erreur OpenAI ({status}). Réessaie." |
| `parse` | JSON invalide renvoyé par l'IA | "L'IA a renvoyé un format invalide. Réessaie." |
| `empty` | Pas de contenu dans la réponse | "Réponse vide de l'IA." |

Affichés dans la modal en bandeau rouge.

## Notes de sécurité

- **Server-only** : la clé API ne quitte jamais le serveur Vercel. Le client ne fait que `useTransition` + appel de server action.
- Pas de validation/sanitization stricte sur le `topic` user → l'IA reçoit le texte tel quel. Pas de risque d'injection puisqu'on contrôle le prompt. **Mais** : pourrait être utilisé pour générer du contenu hors scope (ex: "Écris-moi un poème"). À durcir si abuse observé en gating le user prompt.

## Évolutions possibles

| Feature | Priorité |
|---|---|
| Compteur d'usage par user (table `ai_usage`) | Haute (pré-requis billing) |
| Choix du ton (formel / fun / pro / etc.) | Moyenne |
| Génération multi-pass (vérifier la qualité) | Basse |
| Generation à partir d'une URL (résumé d'article) | Basse |
| Translation : générer en arabe | À couplé avec i18n |
| A/B testing de prompts | Basse |
| Reformulation d'un passage existant | Moyenne |
| Hook variants (générer 5 variantes d'accroche pour A/B test) | Moyenne |
| Streaming des réponses (Server-Sent Events) | Basse — pas un blocker UX vu la vitesse de gpt-4o-mini |

## Alternatives évaluées

- **Anthropic Claude** : qualité similaire, légèrement plus cher (~$1/1M input). Bon pour creative writing FR. À considérer si OpenAI devient un problème.
- **Mistral** : moins cher mais quality FR moins testée pour le use case.
- **Local model** : non envisagé (coût d'infra trop élevé pour un solo SaaS).
