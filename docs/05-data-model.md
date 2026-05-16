# Spec 05 — Data model

## Vue d'ensemble

Postgres via Supabase. Toutes les tables ont **RLS activée** et utilisent le helper `is_brand_member()`. Tables enfants utilisent `content_id` comme FK ou comme PK partagée.

## Diagramme

```
auth.users
  │
  ├─ brands (1:N par created_by)
  │    │
  │    ├─ brand_members (N:N user↔brand avec role)
  │    │
  │    ├─ brand_pillars (1:N)
  │    │
  │    ├─ brand_objectives (1:N)
  │    │
  │    └─ contents (1:N)
  │         │
  │         ├─ reel_details (1:1 si type=reel)
  │         │
  │         ├─ story_details (1:1 si type=story)
  │         │
  │         ├─ story_slides (1:N, 5 slots par story)
  │         │
  │         ├─ storyboard_scenes (1:N, illimité)
  │         │
  │         └─ performances (1:1)

storage.objects (bucket "content-media")
  └─ Path: {content_id}/{uuid}.{ext}
```

## Tables

### `brands`

```sql
id          uuid pk
name        text not null (1-80 chars)
created_by  uuid fk → auth.users (cascade)
created_at  timestamptz
```

Index : (id), unique sur (created_by, name) — non, pas d'unique global, deux brands peuvent porter le même nom si créés par des users différents.

### `brand_members`

```sql
brand_id    uuid fk → brands (cascade)
user_id     uuid fk → auth.users (cascade)
role        brand_role enum ('owner','admin','editor','viewer')
created_at  timestamptz
primary key (brand_id, user_id)
```

### `brand_pillars`

```sql
id          uuid pk
brand_id    uuid fk → brands (cascade)
name        text (1-60 chars)
color       text nullable
position    int default 0
created_at  timestamptz
unique (brand_id, name)
```

### `brand_objectives`

```sql
id          uuid pk
brand_id    uuid fk → brands (cascade)
name        text (1-60 chars)
position    int default 0
created_at  timestamptz
unique (brand_id, name)
```

### `contents`

```sql
id          uuid pk
brand_id    uuid fk → brands (cascade)
user_id     uuid fk → auth.users (cascade)    -- créateur de la vidéo
type        text check in ('reel','story')
title       text nullable
date        date nullable                      -- date de publication prévue
platform    text nullable                      -- 'instagram', 'tiktok', etc.
status      text default 'idea'
              check in ('idea','script','filming','editing','scheduled','published')
pillar      text nullable                      -- texte libre, alimenté par brand_pillars
objective   text nullable                      -- idem brand_objectives
hook        text nullable
cta         text nullable
tags        text[] default '{}'
share_token text unique nullable               -- présent ssi partagé publiquement
created_at  timestamptz
updated_at  timestamptz                        -- mis à jour par trigger
```

**Indexes** : `(brand_id)`, `(brand_id, date)`, `(user_id)`, `(share_token) where share_token is not null`.

### `reel_details`

```sql
content_id   uuid pk fk → contents (cascade)
message_key  text nullable
intro        text nullable
point1       text nullable
point2       text nullable
point3       text nullable
transition   text nullable
recap        text nullable
outro        text nullable
script_full  text nullable
checklist    jsonb default '{}'                -- { script_ready, scenes_ready, filmed, edited, published: bool }
```

### `story_details`

```sql
content_id  uuid pk fk → contents (cascade)
objective   text nullable    -- "What story do I want to tell"
cta_soft    text nullable    -- "Engagement goals"
format      text nullable    -- legacy, peu utilisé
```

### `story_slides`

```sql
id           uuid pk
content_id   uuid fk → contents (cascade)
slot_number  int check between 1 and 10
body         text nullable
image_url    text nullable
unique (content_id, slot_number)
```

Index : `(content_id)`.

### `storyboard_scenes`

```sql
id              uuid pk
content_id      uuid fk → contents (cascade)
scene_number    int check between 1 and 50
description     text nullable        -- Action / Dialogue
camera_angle    text nullable        -- Caméra / Plan
on_screen_text  text nullable        -- Texte affiché
tag             text nullable        -- legacy, peu utilisé
image_url       text nullable
unique (content_id, scene_number)
```

Index : `(content_id)`.

### `performances`

```sql
content_id  uuid pk fk → contents (cascade)
views       int nullable
likes       int nullable
comments    int nullable
shares      int nullable
saves       int nullable
retention   numeric(5,2) nullable
notes       text nullable
updated_at  timestamptz
```

## Fonctions SQL exposées

| Function | Sécurité | Rôle | Utilisée par |
|---|---|---|---|
| `is_brand_member(uuid)` | SECURITY DEFINER | Check membership pour RLS | Toutes les policies |
| `create_brand(text)` | SECURITY DEFINER | Crée brand + membership owner atomic | UI onboarding + page Brands |
| `enable_content_sharing(uuid)` | SECURITY INVOKER | Génère et stocke un share_token | ShareDialog |
| `disable_content_sharing(uuid)` | SECURITY INVOKER | Clear le share_token | ShareDialog |
| `get_shared_content(text)` | SECURITY DEFINER | Renvoie le bundle JSON d'une vidéo partagée | Route `/share/[token]` (anon) |
| `reorder_storyboard_scenes(uuid, uuid[])` | SECURITY INVOKER | Renumérote atomiquement | Drag&drop storyboard |
| `swap_story_slides(uuid, int, int)` | SECURITY INVOKER | Échange body+image entre 2 slots | Drag&drop stories |

## Triggers

| Trigger | Quand | Effet |
|---|---|---|
| `brands_add_owner` | AFTER INSERT on brands | Crée brand_members(owner) |
| `brands_default_created_by` | BEFORE INSERT on brands | created_by := auth.uid() si null |
| `contents_default_user_id` | BEFORE INSERT on contents | user_id := auth.uid() si null |
| `contents_set_updated_at` | BEFORE UPDATE on contents | updated_at := now() |
| `performances_set_updated_at` | BEFORE UPDATE on performances | updated_at := now() |

## RLS pattern

Pattern réutilisé pour toutes les tables liées à une marque :

```sql
alter table public.X enable row level security;

drop policy if exists "X_select" on public.X;
create policy "X_select" on public.X
  for select to authenticated
  using (public.is_brand_member(brand_id));

-- same pattern for insert/update/delete
```

Pour les tables filles (`reel_details`, `performances`, etc.), `brand_id` n'est pas direct → on join via `contents` :

```sql
using (exists (
  select 1 from public.contents c
  where c.id = X.content_id
    and public.is_brand_member(c.brand_id)
))
```

## Storage

### Bucket `content-media`

- **Visibilité** : public (chemin contient un UUID inguessable)
- **Path pattern** : `{content_id}/{uuid}.{ext}`
- **Limites** : 5 MB max par fichier (validé côté client dans `<ImageUpload>`)
- **Formats** : JPG, PNG, WebP (image/*)

### Policies sur `storage.objects`

```sql
-- INSERT : autorisé si le premier segment du path = content_id d'une vidéo dont l'user est membre
create policy "content_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.contents c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_brand_member(c.brand_id)
    )
  );

-- UPDATE, DELETE : même check
-- SELECT : implicite via bucket public
```

## Choix de design

### Pourquoi `contents.pillar` et `contents.objective` sont des `text` et pas des `uuid` FK ?

Préservation de l'historique : si tu renommes ou supprimes un pilier dans `brand_pillars`, les vidéos existantes gardent leur valeur. Le rename cascade explicitement via le server action (mise à jour de toutes les vidéos matchant l'ancien nom). Le delete laisse les vidéos telles quelles (la valeur reste affichée comme texte libre, juste plus dans le dropdown).

### Pourquoi `reel_details.checklist` est un JSONB plutôt que des colonnes ?

Évolution facile : ajouter une étape "Thumbnail" ou "Tournage extérieur" ne nécessite pas de migration de schéma. La logique applicative est typée côté TypeScript dans `lib/types.ts`.

### Pourquoi `story_slides` est une table séparée et pas des colonnes `story1..story5` sur `story_details` ?

Permet :
- Plus de 5 slides à terme (slot_number jusqu'à 10)
- Image upload propre (une row, un fichier)
- Drag&drop atomic via slot_number swap
- Évite la dénormalisation horizontale qui rendrait le schema rigide

### Pourquoi pas d'index sur `contents.type` ou `contents.status` ?

Le volume par utilisateur reste petit (centaines de vidéos max). Les filtres sont déjà rapides avec l'index `(brand_id, date)`. À reconsidérer si la table dépasse 100k rows globalement.

## Évolutions possibles

- **Soft delete** : ajouter `deleted_at` sur `contents` pour permettre l'undo
- **Versioning** : table `content_revisions` pour garder l'historique des scripts
- **Subscriptions** : table `subscriptions` quand on active le billing (voir `03-billing-logic.md`)
- **Invitations** : table `brand_invitations` pour le flow d'invite par email
- **Audit log** : table `activity_log` pour tracer les actions utilisateur
