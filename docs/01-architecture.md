# Spec 01 — Architecture technique

## Vue d'ensemble

Mohtawa est un SaaS Next.js + Supabase déployé sur Vercel. Architecture **server-first** : Server Components, Server Actions, RLS Postgres. Pas d'API REST dédiée — PostgREST (intégré à Supabase) sert les requêtes.

```
┌─────────────┐      ┌─────────────────┐      ┌────────────────┐
│   Browser   │ ←──→ │  Vercel (Next)  │ ←──→ │   Supabase     │
│             │      │   Edge + Node   │      │   Postgres +   │
│             │      │                 │      │   Auth +       │
└─────────────┘      └─────────────────┘      │   Storage      │
                                              └────────────────┘
                                                      │
                                              ┌────────────────┐
                                              │  OpenAI API    │
                                              │  (server only) │
                                              └────────────────┘
```

## Routing (App Router)

### Route groups

| Group | Auth | Layout | Pages |
|---|---|---|---|
| `(auth)` | Publique | Centré, gradient | `/login`, `/register`, `/reset-password` |
| `(app)` | Protégée | Sidebar compacte | `/dashboard`, `/calendar`, `/analytics`, `/hooks`, `/content/[id]`, `/brands`, `/brands/[id]`, `/profile` |
| (racine) | Mixte | Aucun layout | `/share/[token]` (publique), `/print/[id]` (auth requise), `/auth/signout` (POST) |

### Redirections

- `/` (root) → si user authentifié : `/dashboard` ; sinon : `/login`
- Toute route `(app)/*` sans session → redirection middleware vers `/login`
- Auth réussie → `/dashboard`
- Logout → `/login`

## Data flow

### Lecture (Server Components)

```
Server Component (page.tsx)
        │
        ▼
createClient() depuis lib/supabase/server.ts
        │
        ▼
supabase.from('contents').select(...)
        │
        ▼ (HTTP via PostgREST)
Supabase Postgres avec RLS auto-appliquée
        │
        ▼
Data passée en props aux Client Components
```

### Mutation (Server Actions)

```
Form submission (browser)
        │
        ▼
Server Action ("use server") dans actions.ts
        │
        ▼
supabase.from(...).update(...) ou supabase.rpc(...)
        │
        ▼
revalidatePath() pour invalider le cache Next
        │
        ▼
redirect() ou retour structure { ok | error }
        │
        ▼
useTransition côté client gère le pending state
```

### Upload d'image (Client → Storage)

```
Composant ImageUpload (client)
        │
        ▼
createClient() depuis lib/supabase/client.ts (browser)
        │
        ▼
supabase.storage.from('content-media').upload(path, file)
        │
        ▼
supabase.storage.getPublicUrl(path) → URL
        │
        ▼
Server Action updateScene({ image_url })
```

## Sécurité

3 couches superposées :

1. **Middleware Next.js** (`middleware.ts`)
   - Refresh la session Supabase à chaque requête
   - Redirige les non-authentifiés depuis les routes protégées vers `/login`

2. **Row Level Security Postgres** (toutes les tables)
   - Helper `is_brand_member(brand_id)` (SECURITY DEFINER, évite la récursion)
   - Policies SELECT/INSERT/UPDATE/DELETE alignées sur la membership de marque
   - PostgREST applique automatiquement les policies au JWT de l'utilisateur

3. **SECURITY DEFINER RPC** pour les opérations particulières
   - `create_brand(name)` : crée la marque + son owner en bypassant RLS, mais vérifie `auth.uid()` explicitement
   - `get_shared_content(token)` : route publique anon, mais ne renvoie QUE la ligne dont le `share_token` matche

## Cache & invalidation

- Next.js : full route cache + data cache via `fetch` (peu utilisé ici, on lit Supabase via SDK)
- Invalidation : `revalidatePath()` appelée dans chaque Server Action après mutation
- Hot Module Replacement en dev (Turbopack) pour itérer rapidement

## Performance

### Bundle
- App Router minimise le JS expédié au client (Server Components par défaut)
- Composants UI custom → pas de bibliothèque lourde
- Next.js `Image` avec `remotePatterns` pour les images Supabase (mais on utilise `unoptimized` pour les uploads users, évite des coûts)

### DB
- Indexes sur les colonnes filtrées (`brand_id`, `date`, `share_token` quand non-null)
- Indexes sur les jointures fréquentes (`content_id` dans toutes les tables enfants)

### Charts
- `<BarChart>` et `<RankedList>` en CSS pur (pas de canvas/SVG library)

## Tooling local

```bash
npm install
npm run dev        # Turbopack dev server sur :3000
npm run build      # Build de prod (vérifie le TS)
npm run lint
```

Pas de tests unitaires/E2E pour l'instant (priorité produit). À envisager quand le code se stabilise.

## Déploiement

- **Vercel** : auto-deploy sur push `main`, Hobby plan suffit jusqu'à plusieurs centaines d'users
- **Supabase Cloud** : free tier (500 MB DB, 1 GB storage, 50K MAU) — largement suffisant pour la bêta
- **OpenAI** : pay-per-use, OPENAI_API_KEY en var Vercel server-only

Voir [03-billing-logic.md](./03-billing-logic.md) pour les estimations de coûts par utilisateur.
