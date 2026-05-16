# Spec 03 — Billing logic

## Statut actuel : Beta gratuite

> 🟢 **Décision active** : pas de billing implémenté. Tout est gratuit. Voir [ADR 2026-05-16](./decisions/2026-05-16-pas-de-billing-en-beta.md).

Tous les utilisateurs ont accès à 100 % des fonctionnalités sans limite (sauf la limite de l'API OpenAI gérée côté Vercel via la clé OPENAI_API_KEY).

## Coûts d'infra par utilisateur (estimation)

| Service | Coût mensuel par user actif | Plan actuel |
|---|---|---|
| Vercel | ~0 €  | Hobby (gratuit, max ~100k requêtes) |
| Supabase | ~0,01 € (DB) + ~0,01 € (storage) | Free tier (jusqu'à 50k MAU) |
| OpenAI | ~$0.0004 par génération IA | Pay-per-use |
| **Total** | **~0,02 € + AI usage** | |

**À 1000 users actifs** : ~25-50 €/mois infra (probablement Pro tier sur Supabase). Largement couvert dès qu'on a 5-10 paying users.

## Future state — Plans payants

Conception cible (à implémenter quand on a 10-20 active users) :

### Plans

| Plan | Prix | Marques | Vidéos | IA / mois | Membres / marque |
|---|---|---|---|---|---|
| **Trial** (14 jours) | 0 € | 2 | 20 | 10 | 1 |
| **Pro** | 12 €/mois | 5 | illimité | 100 | 3 |
| **Agency** | 29 €/mois | 20 | illimité | 500 | 10 |

### Lifecycle Trial

```
J0  : inscription, trial démarre
J14 : trial expire
J15-90 : mode read-only (peut consulter, pas créer)
J91+ inactif : email "données archivées dans 7 jours si pas d'upgrade"
J98 : soft delete des images (storage), garde le texte
J365 inactif : suppression complète du compte (RGPD)
```

Voir l'ADR sur la gestion de la rétention pour les détails.

### Schéma DB cible

```sql
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial','pro','agency','past_due','canceled')),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,           -- 'YYYY-MM'
  ai_generations_used int not null default 0,
  primary key (user_id, month)
);
```

### Gates côté code

Helpers à créer dans `lib/billing.ts` :

```ts
export async function canCreateBrand(userId: string): Promise<{ ok: boolean; reason?: string }>;
export async function canGenerateAi(userId: string): Promise<{ ok: boolean; reason?: string }>;
export async function canCreateContent(userId: string, brandId: string): Promise<{ ok: boolean; reason?: string }>;
export async function daysLeftInTrial(userId: string): Promise<number>;
```

Appelés au début de chaque server action sensible :

```ts
const gate = await canGenerateAi(user.id);
if (!gate.ok) return { error: gate.reason };
```

Pour la bêta actuelle : **toutes ces fonctions renvoient `{ ok: true }`**. Le wiring sera ajouté quand on activera le billing.

### Intégration Stripe

- **Checkout** : Stripe Checkout hosted (pas de form custom)
- **Webhook** : `POST /api/stripe/webhook` traite `customer.subscription.created/updated/deleted`
- **Customer Portal** : Stripe-hosted, géré 100 % par Stripe (annulation, changement de carte, factures)
- **Sécurité webhook** : signature vérifiée via `stripe.webhooks.constructEvent`

### Flow upgrade

1. User clique "Upgrade" → server action `createCheckoutSession()` → renvoie l'URL Stripe Checkout
2. Redirect vers Stripe → user paie
3. Stripe envoie webhook `customer.subscription.created`
4. Handler met à jour `subscriptions.plan/status`
5. Redirect vers `/dashboard?upgraded=1` → affiche un toast de bienvenue

### Flow trial expiration

Cron Vercel (à mettre en place) :
- Daily check : `select user_id from subscriptions where status = 'trialing' and trial_ends_at < now()`
- Pour chaque : update `status = 'past_due'`, envoie email "ton essai a expiré"

## Décisions explicites encore à prendre

- [ ] Plan **annual** avec discount (-20 % typique) ?
- [ ] Plan **lifetime** one-time pour les early adopters ?
- [ ] Programme d'**affiliation** (30 % comme évoqué dans les docs initiales) ?
- [ ] Promo code à l'inscription ?
- [ ] **Devise** : démarrer EUR ou USD ? (Stripe gère le multi-currency mais simple à l'init)

## Coût opérateur

- Stripe : 1,4 % + 0,25 € par transaction EUR (intra-EU). Marge à conserver dans le pricing.
- TVA : Stripe Tax peut gérer (ajout de 1 % de fee mais évite la galère)
