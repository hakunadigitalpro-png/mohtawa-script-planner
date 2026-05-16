# Spec 06 — Cycle de vie d'un contenu

## Vue d'ensemble

Une vidéo (Reel ou Story) traverse plusieurs **statuts** depuis l'idée jusqu'à la mesure de performance. Le statut est stocké dans `contents.status` et drive certaines UI.

## États & transitions

```
   idea ─────► script ─────► filming ─────► editing ─────► scheduled ─────► published
    │                                                                          ▲
    │                                                                          │
    └─────────────────── transition libre via menu d'action ───────────────────┘
```

| Status | Libellé FR | Signification |
|---|---|---|
| `idea` | Idée | Vient d'être créée, contenu vide |
| `script` | Script | Le script est en cours d'écriture |
| `filming` | Tournage | Le contenu est en phase de production |
| `editing` | Montage | Le montage est en cours |
| `scheduled` | Programmée | Prête à publier, date fixée |
| `published` | Publiée | Mise en ligne, performance à renseigner |

**Pas de transitions forcées** : l'utilisateur peut sauter d'un statut à l'autre (utile si on lui ajoute une vidéo déjà publiée pour suivi).

## Création

### Depuis le Dashboard / Calendrier

Modal `<NewContentModal>` :
1. Choix Format (Reel ou Story)
2. Choix Plateforme (filtrée par format via `platformsForType()`)
3. Titre (optionnel)
4. Date prévue (optionnelle)
5. Submit → Server Action `createContent()`

### Server Action `createContent()`

1. Vérifie `auth.uid()` et `brand_id` (depuis le cookie `active_brand`)
2. `INSERT INTO contents(brand_id, type, title, date, platform, status='idea')`
3. `user_id` rempli automatiquement par trigger BEFORE INSERT
4. Si `type === 'reel'` → crée la row `reel_details(content_id)` vide
5. Si `type === 'story'` → crée la row `story_details(content_id)` vide
6. `revalidatePath('/dashboard')` + `revalidatePath('/calendar')`
7. `redirect('/content/{id}')` → ouvre la fiche détail

## Édition

### Autosave

Chaque champ de l'éditeur autosave via `useAutosave()` (debounce 700ms par défaut) :
- Les champs `<Input>` et `<Textarea>` détectent les changements
- Après 700ms d'inactivité → server action update
- Indicateur visuel `<AutosaveIndicator>` en haut à droite ("Enregistrement..." / "Enregistré ✓")

### Server Actions disponibles

```ts
updateContent(id, patch)          // contents
upsertReelDetails(content_id, patch)
upsertStoryDetails(content_id, patch)
upsertStorySlide(content_id, slot, patch)
upsertPerformance(content_id, patch)
addScene(content_id)
updateScene(scene_id, patch, content_id)
deleteScene(scene_id, content_id)
reorderScenes(content_id, ordered_ids)
swapSlides(content_id, slot_a, slot_b)
duplicateContent(id)
deleteContent(id)
deleteContentInPlace(id)
quickChangeStatus(id, status)
```

## Transitions de statut

### Via le menu d'action sur la card (Dashboard)

`<ContentCard>` propose dans son dropdown (⋮) :
- Ouvrir → naviguer vers `/content/{id}`
- Dupliquer → `duplicateContent()` clone tout sauf `share_token` et `image_url`s
- **Changer le statut** → liste des 6 statuts avec checkmark sur le current
- Supprimer → `deleteContentInPlace()` (reste sur le Dashboard)

### Via la fiche détail

- Onglet **Plan** : dropdown `Statut` modifiable directement
- Onglet **Checklist** : bouton "Marquer comme publiée" → coche tout + passe à `published`

### Effets secondaires

Le statut driver l'affichage uniquement (badge coloré, KPIs Dashboard, charts Analytics). Pas de side effect côté DB (pas de trigger sur status change pour l'instant).

## Drag & drop

### Storyboard (Reel)

- Chaque scène a un drag handle (`⋮⋮` icon)
- Glisser une scène A sur une scène B → A insérée à la position de B, les autres décalent
- Optimistic UI : la grille bouge immédiatement
- Server Action `reorderScenes(content_id, ordered_ids[])` appelle la RPC SQL `reorder_storyboard_scenes` qui renumérote atomiquement (bump à +10000 puis renumérotation 1..N pour éviter le conflit UNIQUE).

### Calendrier

- Chaque vidéo affichée dans une cellule jour est draggable
- Drop sur une autre cellule → `updateContent(id, { date: newDate })`
- Cellule cible mise en évidence avec ring orange

### Stories (5 slots)

- Le `⋮⋮` du label d'une story est draggable
- Drop sur un autre slot → `swap_story_slides(content_id, slot_a, slot_b)` SQL function échange body + image_url entre les 2 slots
- **Les labels (Title/Intro, CTA, etc.) restent associés au slot, pas au contenu** — c'est le contenu qui bouge, les positions sémantiques restent fixes

## Duplication

`duplicateContent(id)` :
1. Lit la vidéo source
2. Insère une nouvelle row contents avec :
   - Même brand_id, type, platform, pillar, objective, hook, cta, tags
   - Titre : `{titre} (copie)` ou `Copie sans titre` si vide
   - `status = 'idea'`, `date = null`
3. Selon le type :
   - **Reel** : copie reel_details (sans image_url) + storyboard_scenes (description/camera/text seulement, pas les image_url)
   - **Story** : copie story_details + story_slides (body seulement, pas les image_url)
4. **Note** : les images ne sont PAS dupliquées (pour éviter des références orphelines en cas de suppression du contenu source). L'utilisateur ré-uploade.
5. `redirect('/content/{newId}')`

## Suppression

`deleteContent(id)` ou `deleteContentInPlace(id)` :
1. `DELETE FROM contents WHERE id = $1`
2. CASCADE supprime :
   - reel_details / story_details / story_slides / storyboard_scenes / performances
3. **Les images dans Storage ne sont PAS supprimées automatiquement** (pas de trigger Storage). À ajouter dans une future version (cleanup batch ou trigger Edge Function).

## Performances

Onglet Performance, autosave sur tous les champs. Quand `performances.views > 0`, la vidéo apparaît dans :
- KPI "Vidéos avec stats" sur `/analytics`
- Classement par pilier
- Top 5 vidéos

## Partage public

Indépendant du statut. Une vidéo peut être partagée publiquement quel que soit son statut (idea, draft, published...). Le `share_token` est null par défaut, généré uniquement à la demande.

Voir [07-sharing-public-pages.md](./07-sharing-public-pages.md).

## Export PDF

Page `/print/[id]` accessible à tout moment depuis la fiche détail. Affiche : Plan, Script ou Stories, Storyboard, Performances. Met en page pour l'impression.

## Évolutions possibles

- **Soft delete** : ajouter `deleted_at` pour permettre l'undo
- **Notifications** : email à J-1 d'une date prévue avec statut `scheduled`
- **Suggestion automatique de statut** : passer en `scheduled` si date renseignée + script complet
- **Cleanup images orphelines** : Edge Function cron qui supprime les images Storage non référencées en DB
- **Versioning du script** : table `content_revisions` qui garde l'historique
