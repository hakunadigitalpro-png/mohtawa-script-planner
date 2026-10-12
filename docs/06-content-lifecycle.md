# Spec 06 — Cycle de vie d'un contenu

_Réécrite le 2026-10-12 (chantier 1). L'ancienne version décrivait six statuts, « published » et un onglet Checklist : trois choses qui n'existent plus._

## La règle

**Un statut change par un geste explicite, ou par le temps qui passe. Jamais par une case cachée.**

Tout ce qui décide d'un statut vit dans **un seul moteur**, en logique pure et testée : [`lib/content-lifecycle.ts`](../lib/content-lifecycle.ts) (tests dans `content-lifecycle.test.ts`). Les actions serveur l'appellent ; elles n'inventent rien. Les quelques lectures et écritures nécessaires pour l'appliquer sont dans [`lib/content-lifecycle-db.ts`](../lib/content-lifecycle-db.ts).

## Le vocabulaire

Deux familles, définies dans `lib/constants.ts` (`STATUSES`, `SIMPLE_STATUSES`), qui partagent leur début, leur boucle client et leur fin :

| Étape | Vidéo (reel, story, vlog) | Simple (post, carrousel, infographie) |
|---|---|---|
| Notée | `idea` Idée | `idea` Idée |
| Choisie en atelier | `selected` Retenue | `selected` Retenue |
| En écriture | `script` Script | `design` Design |
| En tournage | `filming` Tournage | — |
| En montage | `editing` Montage | — |
| Chez le client | `pending_review` En attente de validation | idem |
| Refusée par le client | `needs_revision` À réviser | idem |
| Validée | `approved` Validé | idem |
| Programmée | `scheduled` Programmée | `programmed` Programmé |
| Sortie | `live` En ligne | idem |

`published` subsiste en base comme valeur héritée (0045) ; `isLiveStatus` et le moteur le tiennent pour l'équivalent de `live`. Côté client invité, ces douze valeurs sont projetées en cinq mots (`clientStatusLabel`) : rien de nouveau n'est stocké.

Le moteur place tout ça sur **une seule ligne de temps** (`rankOf`) : Script et Design ont le même rang, Programmée et Programmé aussi. Un geste n'avance que vers l'avant (`isForward`). La correction manuelle reste libre.

## Qui fait avancer quoi

| Transition | Geste | Où |
|---|---|---|
| Idée → Retenue | « Retenir » | onglet Idées (`ideas-actions.ts`) |
| Idée / Retenue → Script ou Design | choisir le format | Plan (`setContentFormat`, via `statusAfterFormat`), onglet Idées, « Planifier » |
| → Tournage | marquer une première scène ou diapo « filmée » | Storyboard / Stories (`applyFilmingProgress`, via `statusAfterFilming`) |
| Tournage → Montage | toutes les scènes filmées | idem |
| → En attente de validation | « Envoyer au client » | bouton d'en-tête (`submitForReview`, RPC `submit_for_review`) |
| En attente → Validé / À réviser | décision du client | `/review` (RPC `client_review_content_many`) |
| Validé → Programmé(e) | « C'est programmé » | bouton d'en-tête (`advanceContent`) |
| Validé (date passée) ou Programmé(e) → En ligne | « C'est en ligne » | bouton d'en-tête (`advanceContent`) |
| Programmé(e) → En ligne | automatique à la lecture, quand date + heure sont passées | RPC `recompute_live_statuses` (0041, 0045), appelée par le tableau de bord, le calendrier et `/review` |
| n'importe quoi → n'importe quoi | menu Statut du Plan, menu ⋮ d'une carte | `updateContent` / `quickChangeStatus` — correction manuelle assumée |

Deux règles valent **par tous les chemins** :

- **« Programmé » exige une publication datée** (`whyNotProgrammed`). C'est cette date que `recompute_live_statuses` lit pour passer en ligne, et elle qui dit « en retard ». Le bouton la demande (« Pour quand ? »), le menu Statut refuse sans elle : « Donne-lui d'abord une date dans Publications. »
- **Tournage et Montage ne s'appliquent qu'aux vidéos**, jamais en arrière, jamais au-delà de Montage.

## Le bouton qui suit le contenu

[`components/content-detail/next-step-button.tsx`](../components/content-detail/next-step-button.tsx), dans l'en-tête de la fiche, ancre `data-tour="content-review"`. Un seul bouton, la seule action orange de la rangée ; `nextStep()` dit ce qu'il montre :

| Statut | Ce qu'on voit | Au clic |
|---|---|---|
| en fabrication | **Envoyer au client** | `submitForReview` — e-mail au client |
| `pending_review` | pastille « Chez le client » | — |
| `approved`, date à venir | **C'est programmé** | passe en Programmé(e) |
| `approved`, aucune date | **C'est programmé** → « Pour quand ? » (plateforme si aucune, date, heure) | crée ou date la publication, puis Programmé(e) |
| `approved`, date passée | **C'est en ligne** | la patronne poste le jour J : Live est la vérité, pas une date inventée |
| `programmed` / `scheduled` | **C'est en ligne** → « Tu as le lien ? » (lien facultatif ; plateforme si aucune publication) | colle le lien, ramène une date future à aujourd'hui, passe en ligne |
| `live` | « Voir en ligne » (lien) ou pastille « En ligne » | ouvre le lien |
| `approved` ou programmé sans format | pastille « Choisis d'abord un format » | — |

L'action serveur `advanceContent` (`app/(app)/contents/lifecycle-actions.ts`) relit tout en base avant d'écrire et refuse ce que le moteur refuse. Les droits sont ceux de la base (`is_brand_writer`, 0052).

Effets déjà en place : la notification « validé — pense à le programmer » (0046) se marque lue toute seule dès que le contenu quitte `approved`.

## Ce que le tableau de bord en dit

- **« Prêt » / « À préparer »** (carte Prochainement) : `isTrulyReady` — la matière existe (script, voix off, diapo écrite ou visuel selon le format, `hasMaterial` + `fetchMaterial`) **et** le contenu n'est ni en écriture ni « À réviser ».
- **Le retard** : `isLate` — la date est passée et le contenu n'est pas en ligne, quelle que soit l'étape. Krea le nomme dans sa note (`dashboardNote`, après le cap fêté, avant la relance générique) avec un lien vers `/dashboard?late=1`. La sortie est dans la phrase : dire que c'est en ligne, ou donner une nouvelle date (retirer la date ramène le contenu en idée).
- Rien de tout cela ne tourne en tâche de fond : tout se calcule à la lecture.

## Création, édition, duplication, suppression

- **Création** : `createContentRow` (`contents/actions.ts`) insère en `idea`, avec ou sans format (0055), et une `content_publications` si une plateforme est donnée ; Krea et l'import passent par le même chemin.
- **Édition** : chaque onglet a ses actions (`upsertReelDetails`, `upsertStorySlide`, `updateScene`, `addContentVisual`, `upsertPerformance`…). Le Plan enregistre explicitement (`useExplicitSave`), les publications sont atomiques (`addPublication`, `updatePublication`, `removePublication` ; le trigger 0020 recopie la principale dans `contents.date / platform / video_url`).
- **Duplication** : `duplicateContent` repart en `idea`, sans date ni images.
- **Suppression** : `deleteContent` / `deleteContentInPlace`, fichiers du stockage retirés avant la ligne (`lib/storage-cleanup.ts`).

## Ce qui a été retiré (0058)

- La RPC `recompute_content_status` (0015) : elle lisait une checklist que plus personne n'écrivait et ignorait la moitié des statuts.
- `contents.auto_status`, son verrou, qui coupait la seule règle utile dès qu'on touchait au statut.
- `reel_details.checklist` et l'onglet Checklist (`checklist-tab.tsx`, `checklist-item-section.tsx`), jamais monté.

`content_checklist_items` reste : ce sont les moments à filmer du Vlog.

Voir l'ADR [2026-10-12 — statut par gestes explicites](./decisions/2026-10-12-statut-par-gestes-explicites.md).
