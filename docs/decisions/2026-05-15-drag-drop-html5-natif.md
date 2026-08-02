# ADR — Drag & drop natif HTML5 (pas de lib)

- **Date** : 2026-05-15
- **Statut** : ✅ Accepted

## Contexte

Plusieurs zones du produit ont besoin de drag & drop :
- **Calendrier** : glisser une vidéo d'un jour à l'autre pour la replanifier
- **Storyboard (Reel)** : réordonner les scènes
- **Stories** : échanger le contenu entre 2 slots

Quelle approche : librairie React DnD / dnd-kit, ou drag & drop HTML5 natif ?

## Options envisagées

### A. `react-dnd`
- ➕ Mature, customisation poussée
- ➖ ~30 KB gzipped
- ➖ API verbose (HOC, hooks)
- ➖ Overkill pour 3 use cases simples

### B. `@dnd-kit`
- ➕ Modern, accessibilité
- ➕ Moins lourd que react-dnd
- ➖ Encore quelques KB
- ➖ Apprentissage de l'API (DndContext, useSortable, etc.)

### C. HTML5 Drag and Drop API native
- ➕ **0 dépendance**
- ➕ Géré par le navigateur
- ➕ Suffisant pour nos cas d'usage
- ➖ API capricieuse historiquement (sur mobile notamment)
- ➖ Moins d'accessibilité keyboard nativement

## Décision

**HTML5 natif**.

Pour 3 use cases simples (drag d'un élément vers un autre), la lib est overkill. Le coût d'apprentissage est minime, et on garde notre bundle léger.

## Implémentation

Pattern utilisé partout :

```ts
const DRAG_MIME = "application/x-mohtawa-{type}-id";

// Sur l'élément draggable
<div
  draggable
  onDragStart={(e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_MIME, id);
  }}
>

// Sur la zone de drop
<div
  onDragOver={(e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;  // ignore drags étrangers
    e.preventDefault();
    setDragOver(true);
  }}
  onDragLeave={() => setDragOver(false)}
  onDrop={(e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_MIME);
    // ... action
  }}
>
```

### MIME types custom

`application/x-mohtawa-content-id` (calendrier), `application/x-mohtawa-scene-id` (storyboard), `application/x-mohtawa-slot-number` (stories).

Avantage : une zone qui attend des scènes ne réagira pas si on traîne une vidéo (et vice-versa).

### Optimistic UI

À chaque drop, on update l'état local immédiatement pour donner le feedback visuel, **puis** on appelle la Server Action. Si l'action échoue, on revert (à implémenter au cas par cas).

## Conséquences

### Positives
- 0 dépendance ajoutée
- Code compréhensible (5-10 lignes par cas)
- Bundle inchangé
- Pas de version à maintenir

### Négatives
- **Mobile** : le drag HTML5 ne marche pas sur tablette / téléphone tactile. Pour l'instant on accepte (Kreatly est desktop-first). À l'avenir si besoin mobile, on pourra ajouter `react-dnd-html5-backend` + `react-dnd-touch-backend`.
- **Accessibilité keyboard** : pas de support natif "alt+arrows pour déplacer". À ajouter manuellement si besoin.
- **Feedback visuel** : pas de "ghost" image custom facile à styler. On utilise `opacity-40` sur l'élément source en CSS.

## Use cases implémentés

### 1. Calendrier (`<CalendarMonth>`)
- Drag d'une card vidéo entre cellules jour
- Drop → `updateContent(id, { date: newDate })`
- Cellule cible : ring orange au survol

### 2. Storyboard (`<StoryboardTab>`)
- Drag handle `GripVertical` sur chaque carte
- Drop → reorder local + `reorderScenes(content_id, ordered_ids)` (atomic SQL)
- Carte cible : scale 102 %

### 3. Stories (`<ScriptTab>` story branch)
- Drag handle dans le label de chaque story
- Drop → `swapSlides(content_id, slot_a, slot_b)` (échange body + image_url)
- Slot cible : scale 103 %

## Liens

- [06-content-lifecycle.md](../06-content-lifecycle.md) — section Drag & drop
- MDN HTML5 D&D : <https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API>
