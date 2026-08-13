---
description: Vérifie qu'une fonctionnalité qui appelle Claude limite et optimise l'usage des tokens IA sur Kreatly
---

Fonctionnalité proposée à évaluer :

$ARGUMENTS

Applique exactement les mêmes critères et le même format de sortie que le sous-agent `logique-tokens` (`.claude/agents/logique-tokens.md`) pour vérifier que cette fonctionnalité limite et optimise l'usage des tokens IA — pas d'appel Claude redondant, `max_tokens` bien dimensionné, rate-limiting (`guardAiAction`) en place, pas de contenu inutile envoyé au modèle. Vérifie dans le code réel — `lib/ai.ts`, `lib/ai-guard.ts` — pas seulement de mémoire.
