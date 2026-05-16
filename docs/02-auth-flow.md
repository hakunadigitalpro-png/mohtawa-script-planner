# Spec 02 — Auth flow

## Vue d'ensemble

Authentification gérée par **Supabase Auth** (email + mot de passe). Pas de SSO, pas de magic link, pas de provider tiers (Google/GitHub) pour l'instant — peut s'ajouter facilement.

## États possibles

| État | Description |
|---|---|
| `not_authenticated` | Aucune session valide (ou expirée) |
| `authenticated_no_brand` | Connecté mais 0 marque créée → écran d'onboarding |
| `authenticated_with_brand` | Cas normal d'utilisation |

## Flow d'inscription (`/register`)

1. User remplit Nom, Email, Mot de passe (≥ 6 caractères)
2. Submit → Server Action `register()` (`app/(auth)/register/actions.ts`)
3. Appel `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
4. **Si email confirmation OFF** (cas actuel) : session créée immédiatement → cookies Set-Cookie → redirect `/dashboard`
5. **Si email confirmation ON** : message "Vérifie ta boîte mail" → l'utilisateur clique le lien dans le mail → session activée
6. À la première connexion → `(app)/layout.tsx` détecte 0 marque → affiche `<NoBrandWelcome>` pour créer la première marque

### Validation

- Email : format basique côté navigateur (`type="email"`)
- Password : `minLength={6}` côté navigateur + check serveur
- Pas de validation complexe (à durcir avec Zod si besoin)

## Flow de connexion (`/login`)

1. User remplit Email + Mot de passe
2. Submit → Server Action `login()` (`app/(auth)/login/actions.ts`)
3. Appel `supabase.auth.signInWithPassword({ email, password })`
4. Si OK → cookies posés → `revalidatePath('/', 'layout')` → `redirect('/dashboard')`
5. Si erreur → renvoie `{ error: "Email ou mot de passe incorrect." }` → affiché en bandeau rouge

## Flow de reset mot de passe (`/reset-password`)

1. User entre son email
2. Server Action `resetPassword()` appelle `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/login' })`
3. Email envoyé via Supabase (template par défaut)
4. **Note** : la page `/login` ne gère pas encore le `?code=...` du reset. Le user reçoit le lien, atterrit sur `/login`, et doit cliquer "Mot de passe oublié" depuis l'app après login pour changer son mot de passe.
5. **TODO** : ajouter une vraie page `update-password` qui consomme le hash dans l'URL

## Session

### Stockage

- Cookies HTTP-only gérés par `@supabase/ssr` :
  - `sb-{ref}-auth-token` (access token + refresh token)
  - `sb-{ref}-auth-token-code-verifier` (PKCE)
- Durée par défaut Supabase : access token 1h, refresh token 7 jours rolling
- Les cookies sont **rafraîchis automatiquement** par le middleware à chaque requête

### Middleware (`middleware.ts` + `lib/supabase/middleware.ts`)

À chaque requête entrante :
1. `createServerClient` avec les cookies de la requête
2. `supabase.auth.getUser()` valide et refresh si nécessaire
3. Si `user === null` ET la route n'est pas publique → redirect `/login`
4. Routes publiques : `/`, `/login`, `/register`, `/reset-password`, `/auth/*`, `/share/*`
5. Si `user !== null` ET la route est `/login`, `/register`, `/reset-password` → redirect `/dashboard` (évite l'utilisateur déjà connecté de revoir le login)

### Logout (`POST /auth/signout`)

Route handler (`app/auth/signout/route.ts`) :
1. `supabase.auth.signOut()` → invalidation server + clear des cookies de session
2. `NextResponse.redirect('/login', { status: 303 })`

Déclenché par le formulaire dans la sidebar (`<form action="/auth/signout" method="post">`).

## Utilisateur courant — accès

### Côté Server Component / Server Action

```ts
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

### Côté Client Component

```ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
```

⚠️ **Ne JAMAIS faire confiance à `user_metadata` côté client pour autoriser une action** — toute autorisation passe par RLS.

## Métadonnées utilisateur

Stockées dans `auth.users.user_metadata` (JSONB) :

```json
{
  "full_name": "Jean Dupont",
  "language": "fr"
}
```

Mises à jour via `supabase.auth.updateUser({ data: { ... } })`.

## Onboarding première marque

Si `user_brands.length === 0` lors de l'accès à `(app)` :
- `layout.tsx` rend `<NoBrandWelcome>` au lieu du contenu
- User crée sa première marque → Server Action `createBrand()` (qui appelle RPC `create_brand`)
- La marque devient automatiquement active (cookie `active_brand`)
- Trigger DB `brands_add_owner` ajoute le user comme owner dans `brand_members`
- Redirection vers `/dashboard`

## Erreurs gérées

| Cas | Message affiché | Note |
|---|---|---|
| Mauvais email/mdp à login | "Email ou mot de passe incorrect." | message générique pour ne pas leaker l'existence du compte |
| Email déjà inscrit à register | Message Supabase brut | TODO : message plus user-friendly |
| Password < 6 caractères | "Mot de passe trop court (6 caractères minimum)." | côté server action |
| Network down | "Une erreur est survenue. Réessaie." | générique |

## Évolutions prévues

- [ ] Réactiver la confirmation email en prod
- [ ] Magic link comme option secondaire
- [ ] Page `update-password` propre qui consomme le code dans l'URL du mail reset
- [ ] SSO Google (cible : créateurs de contenu, beaucoup utilisent Gmail/Workspace)
- [ ] 2FA optionnel
- [ ] Rate limiting sur `/login` (déjà couvert basiquement par Supabase mais à monitorer)
