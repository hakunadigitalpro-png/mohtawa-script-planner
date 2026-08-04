---
description: Revue de code du diff non commité (git diff HEAD), axée qualité + sécurité
allowed-tools: Bash(git diff:*), Read, Grep, Glob
---

Voici le diff des changements non encore commités du projet :

```diff
!`git diff HEAD`
```

Fais une **revue de code senior** de ce diff, avec la même stack et **exactement les mêmes critères** que le sous-agent `code-reviewer` :

Stack : Next.js 16 (App Router, Server Actions) · React 19 · TypeScript strict · Supabase (Postgres, Auth, Storage, **RLS multi-tenant**) · **API Claude côté serveur** · next-intl (FR/AR/EN, RTL).

Analyse **par ordre de priorité** :

1. **SÉCURITÉ** — clé `service_role` Supabase et clé API Claude jamais exposées côté client ; aucun secret en `NEXT_PUBLIC_` ; appels `service_role` et IA uniquement dans des Server Actions / route handlers ; injection, XSS.
2. **ISOLATION MULTI-TENANT** — RLS active sur chaque table ; requêtes scopées par `brand_id`/`user_id` ; jamais de `service_role` qui contourne la RLS sans re-filtrage explicite.
3. **SERVER ACTIONS** — auth vérifiée + entrées validées + requête scopée à la marque.
4. **ROBUSTESSE** — gestion des erreurs des appels Supabase/Claude ; tests manquants sur la logique critique.
5. **QUALITÉ** — frontière Server/Client Components, pas de `any` non justifié, requêtes N+1, chaînes non traduites (next-intl).

**Ignore le style** (laissé aux linters).

**Format de sortie :**
1. **Verdict global** + niveau de risque (🟢 / 🟡 / 🔴).
2. **Problèmes triés par gravité** — `fichier:ligne`, pourquoi c'est grave, le correctif.
3. **1 à 3 corrections prioritaires**.

Si le diff est vide, dis-le et ne fais rien d'autre. Au besoin, ouvre les fichiers concernés (Read/Grep/Glob) pour vérifier le contexte autour des lignes modifiées avant de conclure.
