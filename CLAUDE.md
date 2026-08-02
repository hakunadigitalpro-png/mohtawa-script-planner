# Kreatly Script Planner

SaaS de gestion de production vidéo pour créateurs francophones/arabophones : planifier ses Reels et Stories, structurer ses scripts, suivre la performance, et boucler la boucle Idée → Mesure → Amélioration.

URL prod : <https://mohtawa-script-planner.vercel.app>
Repo : <https://github.com/hakunadigitalpro-png/mohtawa-script-planner>

---

## 📐 Architecture

### Stack technique

| Couche | Tech | Pourquoi |
|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | Server Components, route groups, server actions natifs |
| **UI** | React 19 + TypeScript strict | Stack moderne, types partout |
| **Styling** | Tailwind v4 + CSS variables | Config CSS-first, theming via tokens |
| **Composants UI** | Custom primitives (inspiration shadcn) dans `components/ui/` | Pas de dépendance lourde, contrôle total |
| **Icônes** | `lucide-react` | Légère, cohérente |
| **Forms / utils** | `class-variance-authority`, `clsx`, `tailwind-merge`, `date-fns` | Standards minimaux |
| **Polices** | `Plus Jakarta Sans` (Google Fonts via `next/font`) | Géométrique, gratuite |
| **Backend** | Supabase (Postgres + Auth + Storage + RLS) | Tout-en-un, free tier généreux, RLS puissant |
| **Client Supabase** | `@supabase/ssr` (browser + server) | SSR-safe, gère les cookies |
| **AI** | OpenAI `gpt-4o-mini` via `fetch` (pas de SDK) | Modèle le moins cher (~$0.0004/génération) |
| **i18n** | `next-intl` (installé mais non câblé) | Mis en pause, infrastructure prête |
| **Déploiement** | Vercel + Supabase Cloud | Auto-deploy sur push main |

### Arborescence

```
app/
├── (auth)/                  # Login, register, reset (public, no sidebar)
│   ├── login/
│   ├── register/
│   ├── reset-password/
│   └── layout.tsx
├── (app)/                   # Routes protégées (avec sidebar)
│   ├── dashboard/
│   ├── calendar/
│   ├── analytics/
│   ├── hooks/               # Bibliothèque d'accroches
│   ├── content/[id]/        # Fiche vidéo (5 onglets)
│   ├── brands/              # Liste + détail (gestion taxonomie)
│   │   ├── [id]/
│   │   ├── brands-list.tsx
│   │   ├── create-brand-button.tsx
│   │   ├── taxonomy-actions.ts
│   │   └── page.tsx
│   ├── profile/             # Profil + thème
│   ├── contents/
│   │   ├── actions.ts       # CRUD vidéos
│   │   └── ai-actions.ts    # Génération IA
│   ├── actions.ts           # Brands + Profile + Theme actions
│   └── layout.tsx
├── share/[token]/           # Vue publique read-only (hors auth)
├── print/[id]/              # Page imprimable (hors layout app)
├── auth/signout/            # Route POST de signout
├── globals.css              # Tokens CSS (light/dark/custom)
└── layout.tsx               # Root layout (theme reading)

components/
├── ui/                      # Primitives (Button, Card, Dialog, Select...)
├── charts/                  # BarChart, RankedList
├── content-detail/          # Tabs : Plan, Script, Storyboard, Checklist, Perf
├── sidebar.tsx
├── brand-switcher.tsx
├── content-card.tsx
├── calendar-month.tsx
├── new-content-modal.tsx
├── hooks-library.tsx
├── hooks-picker.tsx
├── ai-generator.tsx
├── theme-switcher.tsx
└── no-brand.tsx

lib/
├── supabase/
│   ├── client.ts            # Browser client (NEXT_PUBLIC_*)
│   ├── server.ts            # Server client (cookies-aware)
│   └── middleware.ts        # Refresh session + auth redirect
├── types.ts                 # Types DB partagés
├── constants.ts             # CONTENT_TYPES, PLATFORMS, STATUSES, etc.
├── utils.ts                 # cn(), formatDateFr()
├── brand.ts                 # Active brand resolution (cookie)
├── theme.ts                 # Theme cookies (light/dark/custom)
├── ai.ts                    # OpenAI wrapper + prompts
└── hooks-data.ts            # 70 accroches FR hardcodées

supabase/migrations/
├── 0000_reset.sql           # Wipe (à exécuter une fois)
├── 0001_initial.sql         # Tables core + RLS
├── 0002_fix_inserts.sql     # BEFORE INSERT triggers
├── 0003_rpc_create_brand.sql
├── 0004_video_only.sql      # Reel+Story only, images, story_slides, bucket
├── 0005_share_and_reorder.sql
├── 0006_brand_pillars_objectives.sql
├── 0007_remove_default_objectives.sql
├── 0008_team_invitations.sql      # Invitations par lien + gestion membres
└── 0009_comments.sql              # Commentaires + threads + read state

messages/                    # i18n (FR/AR prêts, non câblés)
i18n/                        # Config next-intl (non câblé)
middleware.ts                # Next.js middleware (auth gate)
```

---

## 🗄️ Base de données

### Schéma core

```
auth.users              ← Supabase Auth (managé)
       │
       ▼
brands(id, name, created_by, created_at)
       │
       ├─► brand_members(brand_id, user_id, role)
       ├─► brand_pillars(id, brand_id, name, color, position)
       ├─► brand_objectives(id, brand_id, name, position)
       ├─► brand_invitations(id, brand_id, role, token, note, created_by,
       │                     expires_at, used_at, used_by)
       └─► contents(id, brand_id, user_id, type, title, date, platform,
                    status, pillar, objective, hook, cta, tags,
                    share_token, created_at, updated_at)
                  │
                  ├─► reel_details(content_id, intro, point1-3, transition,
                  │                recap, outro, script_full, checklist)
                  ├─► story_details(content_id, objective, cta_soft, format)
                  ├─► story_slides(id, content_id, slot_number 1..10, body, image_url)
                  ├─► storyboard_scenes(id, content_id, scene_number,
                  │                     description, camera_angle, on_screen_text,
                  │                     tag, image_url)
                  ├─► performances(content_id, views, likes, comments, shares,
                  │                saves, retention, notes, updated_at)
                  ├─► content_comments(id, content_id, target_type, target_id,
                  │                    parent_id, user_id, body, resolved,
                  │                    created_at, updated_at)
                  └─► content_reads(user_id, content_id, last_comment_read_at)

storage.objects (bucket "content-media")
       Path: {content_id}/{uuid}.{ext}
```

### Sécurité (RLS)

**Toutes les tables ont RLS activée.** L'accès passe par la fonction helper :

```sql
public.is_brand_member(b uuid) → boolean (security definer)
```

Patterns :
- **Lecture/CRUD sur `contents`** et tables enfants : `public.is_brand_member(brand_id)` doit retourner true
- **Création de marque** : `public.create_brand(name text)` (security definer) — auto-set `created_by = auth.uid()`, ajoute le creator comme owner via trigger
- **Insert sur `contents`** : trigger BEFORE INSERT remplit `user_id = auth.uid()` si vide
- **Partage public** : RPC `public.get_shared_content(token text)` (security definer), exposée à `anon` ; le `share_token` est exclu du payload pour éviter qu'un visiteur ne le réutilise

### Fonctions SQL importantes

| Fonction | Rôle |
|---|---|
| `is_brand_member(uuid)` | Helper RLS (security definer, évite récursion) |
| `create_brand(text)` | Crée une marque + membership owner |
| `enable_content_sharing(uuid)` | Génère un token base64url, le stocke sur `contents.share_token` |
| `disable_content_sharing(uuid)` | Clear le token (révoque le lien) |
| `get_shared_content(text)` | Renvoie un bundle JSON complet d'une vidéo via son token (public) |
| `reorder_storyboard_scenes(uuid, uuid[])` | Renumérote atomiquement en évitant le conflit UNIQUE |
| `swap_story_slides(uuid, int, int)` | Échange body+image_url entre 2 slots de story |
| `create_brand_invitation(uuid, role, text)` | Génère un token + insère la row d'invitation |
| `get_invitation_preview(text)` | Renvoie un preview pour la page /invite/[token] (SECURITY DEFINER) |
| `accept_brand_invitation(text)` | Ajoute l'user comme membre + marque le token utilisé |
| `update_member_role(uuid, uuid, role)` | Change le rôle d'un membre (garde-fou ≥1 owner) |
| `remove_brand_member(uuid, uuid)` | Retire un membre / leave self |
| `list_brand_members_with_emails(uuid)` | Liste les membres + leurs emails (SECURITY DEFINER) |
| `list_content_comments_with_authors(uuid)` | Charge tous les commentaires d'une vidéo + email auteur |
| `mark_content_read(uuid)` | Met `last_comment_read_at = now()` pour l'user courant |
| `count_unread_comments()` | Compte par vidéo le nombre de non-lus pour l'user courant |

### Triggers

| Trigger | Effet |
|---|---|
| `brands_add_owner` (AFTER INSERT) | Crée la row `brand_members` owner |
| `brands_default_created_by` (BEFORE INSERT) | Remplit `created_by = auth.uid()` si null |
| `contents_default_user_id` (BEFORE INSERT) | Remplit `user_id = auth.uid()` si null |
| `contents_set_updated_at` / `performances_set_updated_at` | `updated_at = now()` |

### Storage

- **Bucket** : `content-media` (public, signé non requis)
- **Path** : `{content_id}/{uuid}.{ext}`
- **RLS sur `storage.objects`** : upload/delete réservé aux membres de la brand parente (vérifié via `(storage.foldername(name))[1]::uuid = c.id` joint à `contents`)

---

## 🔐 Auth

- **Provider** : Supabase Auth, email/password
- **Email confirmation** : **désactivée** pour l'instant (fluidité essai) — à réactiver pour la prod
- **Session** : cookies HTTP gérés par `@supabase/ssr`
- **Middleware** (`middleware.ts`) refresh la session à chaque requête et redirige vers `/login` si non authentifié, sauf pour `/`, `/login`, `/register`, `/reset-password`, `/auth/*`, `/share/*`

Helpers d'accès :
- `lib/supabase/server.ts` → `createClient()` pour Server Components / Server Actions
- `lib/supabase/client.ts` → `createClient()` pour composants client (uploads, etc.)

---

## 🧩 Modules fonctionnels

### 1. Authentification
**Routes** : `/login`, `/register`, `/reset-password`, `POST /auth/signout`

Server actions dans `app/(auth)/.../actions.ts`. Pas de magic link (mot de passe uniquement pour l'instant). À l'inscription, `supabase.auth.signUp` est appelé puis si une session est créée immédiatement on redirige vers `/dashboard`.

### 2. Multi-marques & équipe
**Routes** : `/brands`, `/brands/[id]`, `/invite/[token]`

- Une marque = un workspace isolé
- Un user peut être membre de N marques (roles : `owner`, `admin`, `editor`, `viewer`)
- **Marque active** stockée en cookie `active_brand` (résolue par `lib/brand.ts`)
- Switcher dans la sidebar (composant `<BrandSwitcher>`)
- `/brands/[id]` regroupe :
  - **Équipe** : liste des membres avec changement de rôle + retrait, et invitations en attente
  - **Piliers** et **Objectifs** spécifiques à la marque

#### Invitations par lien magique (Sprint 1)
- Owner/admin clique « Créer un lien d'invitation » → choisit le rôle + note
- Génère un token base64url (30 jours de validité)
- Lien copiable : `kreatly.io/invite/{token}`
- L'invité ouvre le lien → preview de l'invitation (marque, rôle, inviter)
  - S'il est connecté : bouton « Accepter » → ajouté à `brand_members` + redirige
  - S'il n'est pas connecté : boutons login/register avec `?next=/invite/{token}` pour revenir après auth
- Les actions (create / revoke / accept / update_role / remove_member) sont dans `app/(app)/brands/team-actions.ts`
- Garde-fou : on ne peut pas retirer / rétrograder le dernier owner d'une marque

### 3. Dashboard
**Route** : `/dashboard`

- **4 KPIs** (Total vidéos, Brouillons, Publiées, Ce mois) — la première est mise en couleur accent
- **Filtres URL-driven** : recherche par titre (`q`), statut, format, plateforme, mois
- **Grille de cards vidéo** avec menu d'action (⋮) : Ouvrir, Dupliquer, Changer statut, Supprimer

### 4. Calendrier
**Route** : `/calendar`

- Vue mois (grid 7×N)
- Items affichés sous forme de pills colorées par type
- **Drag & drop natif HTML5** pour replanifier (MIME custom `application/x-mohtawa-content-id`)
- Click "+" au survol d'une case → ouvre la modal Nouvelle vidéo pré-remplie avec la date

### 5. Éditeur de contenu (5 onglets)
**Route** : `/content/[id]`

#### Plan
- Titre, format (Reel/Story, non-modifiable après création), plateforme (filtrée par type), pilier, objectif, date, statut, accroche, CTA, tags
- **Pilier et objectif** sont des `<SelectWithCreate>` connectés aux tables `brand_pillars` / `brand_objectives` de la marque active (avec bouton orange `+` pour ajouter à la volée)
- **Bouton "Choisir une accroche"** ouvre le picker de la bibliothèque (Hooks)
- **Autosave** sur tous les champs (debounce 700ms)

#### Script (Reel) ou Stories (Story)
- **Reel** : champs structurés (intro, points 1-3, transition, B-roll, recap, outro, script complet) + bouton **Générer avec l'IA**
- **Story** : layout "Storyboard Planner" — 5 cartes verticales (cadres téléphone), drag-swap pour échanger body+image entre slots ; header avec `objective` et `cta_soft` ; bouton **Générer avec l'IA** aussi

#### Storyboard (Reel uniquement)
- Grille 3 colonnes (responsive 2/1) de cartes scènes
- Chaque scène : numéro auto (Plan 01, 02...), upload d'image 16:9, 3 champs (Action/Dialogue, Caméra/Plan, Texte affiché)
- **Drag & drop pour réorganiser** (renumérotation atomique en DB via `reorder_storyboard_scenes`)
- "+ Ajouter une scène" en haut

#### Checklist
- 5 étapes de production (Script ready, Scenes ready, Filmed, Edited, Published)
- Bouton "Marquer comme publiée" qui coche tout + passe le statut à `published`

#### Performances
- Vues, likes, commentaires, partages, sauvegardes, rétention (%), notes
- Autosave

### 6. Bibliothèque d'accroches
**Route** : `/hooks`

- 70 accroches en français hardcodées dans `lib/hooks-data.ts`, 7 catégories
- Recherche par mot-clé + filtres chips par catégorie
- Bouton **Copier** (clipboard) sur chaque card
- Composant `<HooksLibrary>` réutilisé en mode "picker" via `<HooksPickerButton>` dans l'éditeur

### 7. AI Script Generator
**Server action** : `app/(app)/contents/ai-actions.ts`

- Wrapper minimal sur OpenAI Chat Completions (`lib/ai.ts`), pas de SDK
- Modèle : `gpt-4o-mini`, `response_format: json_object`, prompts en français
- 2 modes : `generateReel` (hook + structure complète) et `generateStory` (5 slides + cta_soft)
- Le modal `<AiGeneratorButton>` montre un preview avant application
- **Required** : variable d'env `OPENAI_API_KEY` côté serveur

### 8. Sharing
**Route publique** : `/share/[token]`

- Token base64url de 24 caractères, généré par `enable_content_sharing()` SQL function
- Page **lecture seule**, hors layout `(app)`, branding minimal + badge "Lecture seule"
- Affiche : Plan, Script ou Stories, Storyboard, Performances
- **Robots indexation : disabled** dans la metadata
- Bouton `<ShareButton>` sur la fiche détail pour activer/désactiver/régénérer le token

### 9. Export PDF
**Route** : `/print/[id]`

- Page imprimable, hors layout (app)
- CSS dédié `print.css` avec `@media print` pour cacher les boutons et optimiser le rendu
- Workflow utilisateur : clic "Exporter PDF" → nouvelle page → bouton "Imprimer" → boîte de dialogue navigateur "Enregistrer en PDF"
- **Aucune lib externe** : on s'appuie sur le print-to-PDF du navigateur

### 10. Analytics
**Route** : `/analytics`

- **Pièce maîtresse** : classement par pilier de contenu (RankedList horizontal, top performer mis en avant avec trophée)
- KPIs : total vues, vidéos publiées, vidéos avec stats
- 2 charts mensuels (vues / cadence)
- Top 5 vidéos cliquables
- Badge "↗ en progression" sur le pilier qui gagne le plus de vues ce mois vs précédent

### 11. Commentaires & collaboration (Sprint 2)
**Composants** : `components/comments/`

- Système de commentaires en threads (réponses imbriquées) sur chaque bloc d'une vidéo
- 4 cibles supportées :
  - `plan` → champs du Plan (`general`, `hook`, `cta`)
  - `script` → blocs du script Reel (`intro`, `point1`, `point2`, `point3`, `transition`, `recap`, `outro`, `script_full`)
  - `scene` → chaque scène du storyboard (target_id = UUID de la scène)
  - `slide` → chaque slot 1-5 d'une story (target_id = slot_number)
- **`<CommentButton>`** : petit "💬" cliquable à côté de chaque item commentable, avec compteur + badge orange si non lu + ✓ vert si thread résolu
- **`<CommentsDrawer>`** : panneau latéral droit, 2 modes :
  - **Thread** : un seul thread (target précis) + formulaire d'ajout
  - **Inbox** : liste de tous les threads filtrable (Tous / Non lus / Résolus), inspirée de Boords
- **`<CommentsInboxButton>`** : bouton dans le header de la fiche vidéo, montre le compteur de non-lus
- **`<CommentsProvider>`** : context React qui charge les commentaires de la vidéo une seule fois (props initiales depuis le Server Component) et expose helpers + drawer state
- **Statut "résolu"** : porté par le commentaire racine, toggleable par n'importe quel membre (pas seulement l'auteur)
- **Permissions** : édition/suppression par l'auteur (+ delete par owner/admin de la brand), création/lecture par tout membre
- **Notifications** : in-app uniquement (pas d'email pour l'instant). Le badge non-lu = nombre de commentaires créés après `content_reads.last_comment_read_at` par d'autres users que moi
- Marquage "tout lu" : à l'ouverture du drawer, on appelle `mark_content_read(content_id)` qui upsert `now()`

### 12. Profil & Thème
**Route** : `/profile`

- Nom complet, email (readonly), langue préférée
- **Theme switcher** :
  - 3 modes : Clair, Sombre, Personnalisé
  - 8 presets de couleur d'accent + picker HEX libre
  - 6 presets de teinte de fond + picker HEX libre
  - Reset par défaut
- Préférences stockées en cookies (`mohtawa_theme`, `mohtawa_accent`, `mohtawa_tint`) — durée 1 an, lus en SSR pour éviter le flash

---

## 🎨 Système visuel

### Tokens (definis dans `globals.css`)

- **Background** : gradient warm 3-stops radial (pêche / lavande / blush) sur fond crème `#FDF6EF` (light) ou `#0E0814` (dark), `background-attachment: fixed`
- **Card** : surface tintée crème `#FFFAF4` (light), pas blanc pur
- **Accent** : orange `#FF6B35` saturé, utilisé sur les CTA principaux, le statut actif sidebar, les pills "type"
- **Ink** : presque-noir `#0A0612` pour le texte
- **Lavande** : `#9C7DD8` pour Story et certaines accents
- **Statuts** : couleurs sémantiques fixes (gris/violet/ambre/cyan/vert/etc.)

### Themes

- `html[data-theme="dark"]` override les tokens de surface (deep ink + tinted dark cards)
- `theme === "custom"` injecte les CSS variables via `style` inline sur `<html>` (background, accent)

### Composants UI clés
- `Button` (pill, variants : default/accent/outline/ghost/secondary/destructive/link, sizes : sm/default/lg/icon/icon-sm)
- `Card` (rounded-3xl, soft shadow)
- `Dialog` (custom, click-outside + Escape)
- `Tabs` (pill, active en accent orange)
- `Select` (**custom** — pas le `<select>` natif, popover rounded-2xl)
- `SelectWithCreate` (Select + bouton "+" qui ouvre une modal d'ajout)
- `Dropdown` (menu contextuel)
- `Checkbox`
- `Input`, `Textarea`, `Label`
- `Badge`, `ColorDot`
- `ImageUpload` (drag & drop ou click, upload Supabase Storage, prévisualisation)
- `BarChart`, `RankedList` (charts pure CSS, pas de lib)

---

## 📝 Conventions de code

### Server Components vs Client Components
- **Server Components par défaut** (pas de `"use client"`)
- `"use client"` uniquement si :
  - Le composant utilise des hooks (`useState`, `useEffect`, etc.)
  - Il manipule des event handlers (`onClick`...)
  - Il consomme un contexte React
- Les Server Components fetchent directement la DB ; les Client Components reçoivent les données en props

### Mutations
- **Server Actions** (`"use server"`) dans des fichiers `actions.ts` colocalisés
- Pattern de retour : `{ ok: true, ...payload } | { error: string }`
- Les forms utilisent `<form action={fd => startTransition(...)}>` avec `useTransition` pour les pending states
- `revalidatePath()` à la fin des mutations qui touchent des données affichées
- `redirect()` (de `next/navigation`) pour rediriger après création

### Sécurité
- **Jamais** de vérification "ce user a-t-il accès à cette ressource" côté app — toujours via RLS
- Les server actions appellent Supabase qui applique RLS automatiquement
- Pour les opérations qui doivent contourner RLS (création initiale, partage public) : RPC `SECURITY DEFINER` avec checks explicites de `auth.uid()`

### Naming
- **Fichiers** : `kebab-case.tsx` (sauf routes Next.js qui suivent leurs conventions)
- **Composants** : `PascalCase`
- **Server actions** : `camelCase` (verbe à l'infinitif)
- **Types** : `PascalCase`

### Tailwind
- Utiliser les tokens CSS variables au lieu de couleurs hardcodées (`text-foreground`, `bg-card`, `bg-accent`...)
- `cn()` (de `lib/utils.ts`) pour combiner les classes conditionnelles

### Migrations
- Numérotées `0001_*.sql`, `0002_*.sql`, etc.
- **Toujours idempotentes** : `create table if not exists`, `drop policy if exists ... create policy ...`, `alter table ... add column if not exists`
- Une migration = une feature (pas de mégamigration)
- Le SQL est exécuté manuellement dans le SQL Editor Supabase (pas de migrate automatique)

---

## 🧠 Décisions importantes (et pourquoi)

### Stack & infra

1. **Supabase plutôt que Firebase / backend custom**
   _Postgres + Auth + Storage + Realtime + RLS dans un seul service. Free tier généreux. Code SQL standard, transférable._

2. **Drop Prisma au profit de `supabase-js` pur**
   _Prisma était redondant avec PostgREST + RLS. Une couche en moins, types générés par Supabase suffisent._

3. **App Router (pas Pages Router)**
   _Server Components, fetch direct depuis la DB, routing imbriqué, server actions natifs._

4. **Tailwind v4 (CSS-first)**
   _Plus rapide, config dans `globals.css` via `@theme`, syntaxe plus simple. Pas besoin de `tailwind.config.js`._

5. **Composants custom (pas shadcn CLI)**
   _Contrôle total, pas de codegen, dépendances minimales. Inspiration shadcn mais code maison._

### Architecture & data

6. **RLS-first sécurité**
   _Toute la sécurité tient dans les policies Postgres. Pas de checks app-level qui pourraient être bypassés. Helper `is_brand_member()` en `security definer` pour éviter la récursion._

7. **Image uploads via Supabase Storage public bucket**
   _Bucket public + paths avec UUIDs inguessables. Simple et perf. Pour la prod, on pourrait passer en signed URLs si besoin._

8. **Stockage des pilier/objectif comme TEXT sur `contents`**
   _Pas de FK vers `brand_pillars`/`brand_objectives` pour préserver l'historique des vidéos si on renomme/supprime. Le rename cascade explicitement via le server action. Le delete ne casse rien (le texte reste)._

9. **Brand-scoped taxonomies**
   _Chaque marque a ses propres piliers et objectifs. Liste **vide par défaut** (décision 0007) — le user remplit selon son projet._

### Features

10. **AI : OpenAI `gpt-4o-mini`**
    _Modèle le moins cher (~$0.0004/génération) tout en étant suffisant pour générer des scripts FR structurés. `response_format: json_object` évite le parsing fragile._

11. **Drag & drop natif HTML5 (pas de lib)**
    _MIME types custom pour ne réagir qu'à nos propres draggables. Code plus simple qu'un wrapper React DnD._

12. **PDF export via print CSS du navigateur**
    _Pas de Puppeteer/jsPDF/react-pdf. Une page `/print/[id]` avec un CSS dédié, l'utilisateur fait Ctrl+P → Enregistrer en PDF. Robuste et gratuit._

13. **Hooks library : statique en code**
    _70 accroches hardcodées dans `lib/hooks-data.ts`. Pas de DB. Plus rapide à shipper. Peut migrer en DB plus tard si on veut crowd-sourcer._

14. **Sharing via token base64url + RPC public**
    _Pas de "share avec utilisateur authentifié" pour l'instant — uniquement des liens publics. Token rotable. Page exclue de l'indexation Google._

15. **Theme via cookies (pas localStorage)**
    _Lu en SSR → pas de flash au chargement. Persistance 1 an._

### Business

16. **Pas de billing / Stripe pour l'instant (option D)**
    _Lancement en bêta gratuit ouvert. On ajoutera billing quand on aura 10-20 utilisateurs actifs et qu'on saura ce qu'ils paieraient. L'architecture le permet — on ajoute juste `subscriptions` + Stripe webhook plus tard._

17. **i18n mise en pause**
    _On a installé `next-intl` et créé `messages/fr.json` + `messages/ar.json` complets, mais on n'a pas câblé les composants. La fonctionnalité reviendra après le redesign visuel (sinon double travail si le wording change)._

### UX

18. **Sidebar compact icon-only (80px) avec tooltips au hover**
    _Inspiration directe du user. Donne +176px au contenu vs sidebar large._

19. **Email confirmation OFF en dev**
    _Pour fluidifier les tests. À réactiver pour la prod._

20. **Background : gradient warm sur toute la page**
    _Décision visuelle prise après les premières maquettes : cards crème teinté qui flottent sur gradient pêche/lavande. Ambiance "Notion-meets-Linear-with-warmth"._

---

## ✅ Ce qui est fait

| Module | Status |
|---|---|
| Auth (login/register/reset/signout) | ✅ |
| Multi-marques (CRUD, switcher, roles) | ✅ |
| Brand-scoped pilliers + objectifs (CRUD + cascade rename) | ✅ |
| Dashboard (KPIs, filtres URL, search, action menu) | ✅ |
| Calendrier mensuel + drag&drop replan | ✅ |
| Modal Nouvelle vidéo (Reel/Story + plateformes contextuelles) | ✅ |
| Fiche éditeur 5 onglets avec autosave | ✅ |
| Plan : tous les champs + dropdown brand-scoped | ✅ |
| Script Reel structuré + AI generator | ✅ |
| Stories phone-preview + drag-swap + AI generator | ✅ |
| Storyboard grille 3-col + image upload + drag reorder | ✅ |
| Checklist + Performances (autosave) | ✅ |
| Bibliothèque d'accroches (70 hooks) + picker | ✅ |
| Analytics (pillar ranking + plat/format + top videos + charts) | ✅ |
| Profil + langue préférée | ✅ |
| Système de thèmes (Light/Dark/Custom + color picker) | ✅ |
| Sharing via lien public (token rotable) | ✅ |
| Export PDF (page imprimable) | ✅ |
| Image uploads (storyboard scenes, story slides) | ✅ |
| Sidebar compacte avec tooltips | ✅ |
| **Équipe : invitations par lien + gestion rôles** | ✅ |
| **Commentaires en threads sur tous les blocs vidéo** | ✅ |
| **Inbox commentaires + compteur non-lus** | ✅ |

---

## ⏳ Ce qui reste à faire

| Bloc | Priorité | Note |
|---|---|---|
| **i18n FR + AR + RTL** | Moyenne | Infrastructure prête (`messages/*.json` + `i18n/`), wiring à finir après stabilisation du wording |
| **Email notifications** | Basse | Reminders avant date de publication, mail de bienvenue, mention sur commentaire |
| **Mobile polish** | Moyenne | Quelques pages assument desktop (calendrier surtout) |
| **Analytics avancées** | Basse | Filtre par période, comparaison vs période précédente, export CSV |
| **Templates** | Basse | Reel/Story pré-remplis (réutiliser une fiche comme template) |
| **Stripe + plans payants** | Phase 4 | Quand on a les premiers clients qui veulent payer |
| **Landing page publique** | Phase 4 | Actuellement `/` redirige vers `/login` ou `/dashboard` |

---

## 🚀 Migrations & déploiement

### Migrations Supabase (à exécuter dans l'ordre dans le SQL Editor)

| Fichier | Effet |
|---|---|
| `0000_reset.sql` | Wipe le schéma (à exécuter UNE SEULE FOIS si DB déjà bricolée) |
| `0001_initial.sql` | Tables core + indexes + triggers + RLS de base |
| `0002_fix_inserts.sql` | BEFORE INSERT triggers pour `brands.created_by` et `contents.user_id` |
| `0003_rpc_create_brand.sql` | RPC `create_brand()` SECURITY DEFINER |
| `0004_video_only.sql` | Restreint types à reel/story, ajoute image_url, story_slides, bucket content-media |
| `0005_share_and_reorder.sql` | `share_token`, RPC public partage, reorder/swap atomiques |
| `0006_brand_pillars_objectives.sql` | Tables piliers + objectifs par marque |
| `0007_remove_default_objectives.sql` | Drop le seed des 5 objectifs par défaut |
| `0008_team_invitations.sql` | Table `brand_invitations` + RPC create/accept/revoke/role/member |
| `0009_comments.sql` | Tables `content_comments` + `content_reads` + RPC list/mark/count |

### Variables d'environnement

#### Vercel (Production + Preview + Development)

```
NEXT_PUBLIC_SUPABASE_URL        = https://ylhsnlxefxeuxtblcmwd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (anon key from Supabase API settings)
OPENAI_API_KEY                  = sk-... (optionnel, requis seulement pour l'IA)
```

#### Local (`.env.local`)

Mêmes variables. **Ne JAMAIS commiter** ce fichier (`.gitignore` le protège).

### Workflow de déploiement

1. Modifs en local sur `main`
2. `npm run dev` pour tester sur `localhost:3000`
3. `git commit` + `git push origin main`
4. Vercel rebuild automatique (~1-2 min)
5. Vérif sur `mohtawa-script-planner.vercel.app`

Pour les changements DB :
1. Ouvrir le fichier `0XXX_*.sql` du dossier `supabase/migrations/`
2. Copier le contenu dans le SQL Editor Supabase
3. Run

### Tests rapides post-déploiement

- `/login` → tente une connexion avec un mauvais mot de passe → erreur claire
- `/dashboard` → cards affichées, filtres fonctionnels
- Crée un Reel → onglets Plan, Script, Storyboard, Checklist, Perf
- `/calendar` → drag d'une vidéo d'un jour à l'autre
- `/analytics` → si t'as des vidéos avec performances, le pillar ranking apparaît
- `/brands/[id]` → ajout d'un pilier, vérifie qu'il apparaît dans le dropdown Plan
- Bouton "Partager" → copie le lien → ouvre dans une fenêtre privée → la vidéo s'affiche read-only
- Bouton "Exporter PDF" → nouvelle page → Ctrl+P → Enregistrer en PDF

---

## 🔑 Fichiers à connaître

| Si tu touches à... | Va voir... |
|---|---|
| Le SQL / la DB | `supabase/migrations/` |
| Une mutation côté DB | `app/(app)/.../actions.ts` ou `taxonomy-actions.ts`, `ai-actions.ts` |
| Le contrat client Supabase | `lib/supabase/{client,server,middleware}.ts` |
| L'auth/redirection | `middleware.ts` + `lib/supabase/middleware.ts` |
| La palette ou les radii | `app/globals.css` (tokens `@theme`) |
| Une nouvelle primitive UI | `components/ui/` |
| La sidebar/nav | `components/sidebar.tsx` |
| L'éditeur 5 onglets | `components/content-detail/*.tsx` |
| Le générateur IA | `lib/ai.ts` (prompts) + `app/(app)/contents/ai-actions.ts` |
| Les types DB | `lib/types.ts` |
| Les listes (statuts, formats...) | `lib/constants.ts` |
| Les accroches | `lib/hooks-data.ts` |
| Le système de thèmes | `lib/theme.ts` + `components/theme-switcher.tsx` + `app/layout.tsx` |
| La page de partage public | `app/share/[token]/page.tsx` |
| La page d'impression | `app/print/[id]/page.tsx` + `print.css` |

---

_Dernière mise à jour : ce doc évolue avec le projet. À mettre à jour quand on prend une décision structurante._
