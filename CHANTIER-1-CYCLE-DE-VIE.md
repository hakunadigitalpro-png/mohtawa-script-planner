# Chantier 1 — Le cycle de vie d'un contenu

**Date :** 2026-10-12
**Origine :** [PARCOURS-UTILISATEUR.md](PARCOURS-UTILISATEUR.md), constats 2, 6, 10, 14, 19, 20 ; propositions P1, P6, P10.
**Statut :** plan soumis à `logique-produit` et `ui-design`, puis à Mariam. **Rien n'est codé.**

---

## 1. Ce qui ne va pas aujourd'hui (vérifié dans le code)

1. **Deux moteurs de statut qui s'ignorent.** La RPC `recompute_content_status` (0015) lit `reel_details.checklist.script_ready` et `.edited`, que seul `checklist-tab.tsx` écrit — onglet retiré de `detail-tabs.tsx`. Ses rangs s'arrêtent à `published` : elle ne connaît ni `approved`, ni `live`, ni `pending_review`, ni les statuts des formats simples. Seule sa règle « ≥ 1 scène filmée → Tournage » fonctionne encore. Le badge « ✨ Auto » de `plan-tab.tsx:168` promet une progression qui n'existe plus.
2. **`auto_status` est un verrou qui ne verrouille rien d'utile.** Chaque changement manuel le passe à `false` (`updateContent`, `ideas-actions.ts`), ce qui coupe la seule règle vivante (filmé → Tournage) dès qu'on touche au statut une fois.
3. **Validé → Programmé coûte cinq gestes et se rate en silence.** Seuls chemins : menu Statut du Plan + Enregistrer, ou menu ⋮ d'une carte du tableau de bord. La cloche « pense à le programmer » (0046) n'a pas d'action. Oublié, le contenu ne passe jamais Live : `recompute_live_statuses` ne bascule que `programmed`/`scheduled` **et** seulement s'il existe une `content_publications` datée.
4. **Rien ne dit « C'est en ligne »** avant la date+heure programmée. Si elle poste plus tôt, ou sans heure, elle doit retrouver le menu Statut.
5. **« Prêt » rassure à tort.** `dashboard/page.tsx isReady` = `status ∉ {idea, design}` : un reel en « Script » sans une ligne est « Prêt ».
6. **Rien ne dit ce qui est en retard.** « Prochainement » part d'aujourd'hui ; un contenu daté d'hier et pas sorti n'apparaît nulle part.
7. **« Voir tout » des commentaires ouvre le planning**, pas les commentaires (`dashboard/page.tsx:381`).

---

## 2. Le métier : ce qu'un contenu vit, et qui le fait avancer

Deux familles gardent leur vocabulaire (`lib/constants.ts`, inchangé) :

- **Vidéo** (reel, story, vlog) : Idée → Retenue → Script → Tournage → Montage → Validé → Programmée → Live
- **Simple** (post, carrousel, infographie) : Idée → Retenue → Design → En attente de validation → À réviser / Validé → Programmé → Live

Les statuts communs (`idea`, `selected`, `approved`, `live`) et la boucle client (`pending_review`, `needs_revision`) sont atteignables par les deux familles — c'est déjà le cas en base (0042, 0045, 0055).

**Règle unique : un statut change par un geste explicite, ou par le temps qui passe. Jamais par une case cachée.**

| Transition | Geste | Existe ? |
|---|---|---|
| Idée → Retenue | Onglet Idées, « Retenir » | oui |
| Retenue → Script / Design | Choisir le format (Plan ou « Développer ») | oui (`writingStatusFor`) |
| Script → Tournage | Marquer une première scène « filmée » | oui, **réécrit en TypeScript** (règle 2 de 0015) |
| Tournage → Montage | Toutes les scènes filmées | oui, **réécrit en TypeScript** (règle 3 de 0015) |
| … → En attente de validation | « Envoyer au client » | oui (RPC `submit_for_review`) |
| En attente → Validé / À réviser | Décision du client | oui (RPC `client_review_content_many`) |
| Validé → Programmé(e) | **Nouveau bouton « C'est programmé »** | à construire |
| Programmé(e) → Live | Automatique à la lecture quand date+heure passées | oui (`recompute_live_statuses`) |
| Programmé(e) → Live | **Nouveau bouton « C'est en ligne »** (lien facultatif) | à construire |
| N'importe quoi → n'importe quoi | Menu Statut du Plan, menu ⋮ des cartes | oui, **gardé** comme correction manuelle |

Ce qu'on retire : la RPC `recompute_content_status`, la colonne `contents.auto_status`, le badge « ✨ Auto », `checklist-tab.tsx` + `checklist-item-section.tsx` (jamais montés), la colonne `reel_details.checklist` (plus écrite par personne). On garde `content_checklist_items` : le Vlog s'en sert pour ses moments à filmer.

---

## 3. Ce qu'on construit

### 3.1 Un seul moteur, en TypeScript, testé — `lib/content-lifecycle.ts`

Logique pure, sans Supabase, comme `lib/krea-notes.ts` :

- `stepsFor(type)` : la liste ordonnée des statuts de la famille (depuis `statusesForType`).
- `isForward(from, to, type)` : on n'avance que vers l'avant par un geste ; la correction manuelle (Plan, ⋮) reste libre.
- `nextStep({ status, type, hasFuturePublication, url })` → ce que le bouton d'en-tête propose :
  - en production (idea, selected, script, filming, editing, design, needs_revision) → `send_to_client`
  - `pending_review` → `waiting_client`
  - `approved` → `mark_programmed`, avec `needsDate = !hasFuturePublication`
  - `programmed` / `scheduled` → `mark_live`
  - `live` → `online`
- `programmedStatusFor(type)` : `programmed` pour un format simple, `scheduled` pour une vidéo (vocabulaire existant, pas un troisième).
- `statusAfterFilming({ status, type, filmed, total })` : Script → Tournage dès une scène filmée, Tournage → Montage quand toutes le sont ; jamais en arrière, jamais au-delà de Montage, jamais pour un format simple. Appelée par `updateScene` et `upsertStorySlide` à la place de la RPC.
- `isTrulyReady({ status, type, hasMaterial })` : « Prêt » = la matière existe **et** le contenu n'est plus en écriture (`status ∉ {idea, selected, script, design}`). Matière = script non vide (reel : `script_full` ou `intro` ; vlog : `voiceover` ; story : ≥ 1 diapo avec texte) ou ≥ 1 visuel (formats simples).
- `isLate({ status, date, today })` : date passée et statut ≠ `live`/`published`. Calculé à la lecture, pas de tâche de fond.

Tests : `lib/content-lifecycle.test.ts` (une ligne par transition, les deux familles, le « jamais en arrière », le retard, le prêt).

### 3.2 Le bouton qui suit le contenu — en-tête de la fiche

`components/content-detail/next-step-button.tsx` **remplace** `submit-review-button.tsx` au même emplacement (`data-tour="content-review"`). Un seul bouton, qui change d'étiquette avec le statut — pas un sixième contrôle dans l'en-tête, qui en porte déjà cinq.

| Statut | Ce qu'on voit | Au clic |
|---|---|---|
| en production | « Envoyer au client » | inchangé (`submitForReview`) — le garde « as-tu un client invité ? » arrive au chantier 2 (P3), ce composant recevra une `reason` |
| `pending_review` | pastille « Chez le client » | — |
| `approved` | « C'est programmé » | s'il existe déjà une publication datée dans le futur : passe en Programmé(e) ; sinon petite boîte « Pour quand ? » (plateforme si aucune, date, heure facultative) qui crée ou met à jour la publication, puis passe en Programmé(e) |
| `programmed` / `scheduled` | « C'est en ligne » | boîte « Tu as le lien ? » avec un champ URL facultatif (« Colle-le si tu l'as, sinon plus tard dans Performances ») → `updatePublication({ url })` sur la publication principale + statut Live |
| `live` | pastille « En ligne », avec icône de lien si une URL existe | ouvre le lien |

Server action nouvelle `advanceContent({ contentId, step, date?, time?, platform?, url? })` dans `app/(app)/contents/lifecycle-actions.ts` : relit le contenu, vérifie `isForward` avec le moteur, écrit la publication via les helpers existants (`addPublication` / `updatePublication`), puis le statut. Droits : RLS `is_brand_writer` (0052) — un `viewer` n'arrive jamais sur cette page (`content/[id]/page.tsx:71`).

Effets déjà en place qu'on réutilise : la notification `ready_to_schedule` se marque lue toute seule quand le contenu quitte `approved` (trigger 0046) ; `recompute_live_statuses` continue de basculer en Live à la date.

Texte de la visite guidée (`lib/krea-tours.ts`, étape `content-review`) mis à jour : « Ce bouton suit ton contenu : envoie-le au client, puis dis-moi quand c'est programmé, puis quand c'est en ligne. »

### 3.3 Le tableau de bord dit vrai

- **« Prêt » / « À préparer »** calculés avec `isTrulyReady` : pour les six contenus de « Prochainement », une requête groupée par table (comme `lib/thumbnails.ts`) pour savoir s'il y a un script, des diapos ou un visuel.
- **Le retard, dit par Krea** : `dashboardNote` reçoit `late` (nombre de contenus en retard). Nouvelle règle, placée après le cap fêté et avant « rien de planifié » : « 2 contenus ont dépassé leur date sans sortir — ouvre-les, et dis-moi s'ils sont en ligne. » ton `push`. `KreaNote` gagne un `action?: { label, href }` facultatif, rendu par `KreaNoteCard` comme un lien (« Les voir ») vers `/dashboard?late=1`.
- **Filtre `late=1`** sur la liste du tableau de bord : `date < aujourd'hui` et statut ≠ live. Dans `dashboard-filters.tsx`, une pastille « En retard × » quand il est actif, rien de plus.
- **Carte Commentaires** : le lien devient « Voir les non lus » et ouvre `/calendar?view=planning&unread=1` ; le planning filtre alors sur `commentCounts > 0` (déjà calculé). Vide : « Tout est lu. » Le libellé dit ce qui se passe.

### 3.4 Ce qu'on retire, et dans quel ordre

Code d'abord (déployé sans que la base change), migration ensuite — Mariam la joue à la main.

1. Supprimer `checklist-tab.tsx`, `checklist-item-section.tsx` ; retirer `checklist` de `upsertReelDetails`, `checklist: {}` de `duplicateContent`, le champ `checklist` de `ReelDetails` et `auto_status` de `Content` (`lib/types.ts`) ; retirer `auto_status: false` des écritures (`updateContent`, `ideas-actions.ts`) ; retirer les quatre appels `supabase.rpc("recompute_content_status")` ; retirer le badge du Plan.
2. Migration `0058_statut_par_gestes.sql` (idempotente) : `drop function if exists recompute_content_status(uuid)` ; `alter table contents drop column if exists auto_status` ; `alter table reel_details drop column if exists checklist`. Avec `supabase/checks/verify_0058.sql`.
3. Le menu Statut du Plan reste, avec une ligne d'aide : « Le bouton en haut de la fiche fait avancer ton contenu. Ici, tu corriges à la main si besoin. »

### 3.5 Documentation

- `docs/06-content-lifecycle.md` réécrit : il décrit encore six statuts, « published » et la Checklist. Il devient la référence métier du cycle (la section 2 ci-dessus, détaillée).
- ADR `docs/decisions/2026-10-12-statut-par-gestes-explicites.md`.
- `CLAUDE.md` : décision 21, et section 5 « Checklist » retirée.
- Libellés i18n fr/en/ar : `lifecycle.markProgrammed`, `lifecycle.markLive`, `lifecycle.online`, les deux boîtes, la pastille « En retard », « Voir les non lus », « Tout est lu ».

---

## 4. Ordre de livraison (chaque étape déployable seule)

1. Moteur + tests + docs — aucun changement visible.
2. Bouton d'en-tête + action + visite guidée.
3. Tableau de bord : « Prêt » réel, note de retard, filtre, lien des commentaires.
4. Retrait du code mort, puis migration 0058 jouée par Mariam, puis vérification.

Effort global : **petit à moyen** — aucune table nouvelle, une migration de nettoyage, un composant d'en-tête, deux boîtes de dialogue, une règle de note.

---

## 5. Points soumis aux gardiens

À `logique-produit` :
- La définition de « Prêt » (matière + plus en écriture) et de « en retard » (date passée, statut ≠ live) — en particulier : un contenu `pending_review` daté d'hier est-il « en retard » ? (proposé : oui, la date est passée).
- « C'est programmé » exige une publication datée dans le futur : si la seule date est passée, la boîte « Pour quand ? » se pré-remplit et demande la vraie date (sinon `recompute_live_statuses` le passerait Live au prochain affichage).
- Garder le menu Statut du Plan et le ⋮ des cartes comme correction manuelle (doublon assumé, même action `updateContent`).
- Retirer la règle « script_ready → Script » et « edited → Programmée » de 0015 sans remplacement : le format choisi donne déjà « Script », le bouton donne « Programmé ».
- La place de la règle « retard » dans la hiérarchie de `dashboardNote`.

À `ui-design` :
- Un seul bouton d'en-tête qui change d'étiquette, cinq contrôles au total, tenue à 400 px.
- Les deux boîtes (« Pour quand ? », « Tu as le lien ? ») : trois champs au plus, la raison en texte sous le bouton quand il est désactivé.
- La note de retard avec un lien « Les voir », ton coach, pas de rouge.
- La pastille de filtre « En retard × » et l'état vide « Tout est lu ».

---

## 6. Verdicts

**`logique-produit` — ⚠️ Cohérent avec réserves**, toutes intégrées :

- A. « Programmé » exige une date **par tous les chemins** : `updateContent` (menu Statut, ⋮) refuse `programmed`/`scheduled` sans publication datée — même règle que le bouton (`whyNotProgrammed`).
- B. Validé avec une date déjà passée → **« C'est en ligne »** directement, pas « Pour quand ? » avec une date inventée.
- C. `statusAfterFilming` avance depuis Idée / Retenue / Script (pas seulement Script) ; `setContentFormat` applique « Script » / « Design » quand le contenu est encore en Idée / Retenue (`statusAfterFormat`).
- D. « Prêt » exclut aussi `needs_revision` ; sans format, jamais prêt ; la note « N contenus **prêts** et aucun publié » devient « N contenus **créés** et aucun en ligne ».
- E. `pending_review` daté d'hier est en retard, oui. La note de retard passe **après** le cap fêté et **avant** la relance générique ; la phrase nomme la sortie (« dis-moi s'ils sont en ligne, ou donne-leur une nouvelle date »).
- F. « Voir les non lus » liste les contenus à remarque non lue **tous mois confondus**, flèches de mois masquées ; un `viewer` peut y venir (lecture, par personne).
- G. « vidéo » → « contenu » dans les messages de `addPublication` / `updatePublication` ; sans format en Validé, le bouton dit « Choisis d'abord un format » ; décisions de `CLAUDE.md` renumérotées (19 → 20 → 21), la nouvelle est la 22.

**`ui-design` — ⚠️ Acceptable avec réserves**, toutes intégrées :

- A1. Le bouton d'en-tête est `accent` `sm` dans ses états actifs — seul orange de la rangée ; états passifs en pastille neutre ; « Exporter PDF » aligné sur `buttonVariants({ outline, sm })` pour une seule hauteur.
- A3. L'erreur s'écrit **en texte** sur sa propre ligne (`basis-full`, couleur explicite sur le bandeau), jamais en infobulle ; « Envoi… » / « Enregistrement… » + `aria-busy` pendant l'action.
- A4. En ligne avec un lien → « Voir en ligne » (outline, `target=_blank`) ; sans lien → pastille « En ligne » ; `statuses.live` dit désormais « En ligne » en français.
- B1. « Pour quand ? » : Plateforme (si aucune), Date, « Heure (optionnel) » ; aide **sous le champ Date**, en `destructive` + `role="alert"` dès qu'une date passée est saisie ; les deux boutons désactivés pendant l'envoi ; `max-w-md`.
- B2. « Tu as le lien ? » : « Lien du contenu (optionnel) », secondaire « Annuler » (jamais « Plus tard »), URL normalisée (`https://` ajouté) ; sans aucune publication, un champ « Où est-il sorti ? ».
- C1. Le lien « Les voir → » au bout de la phrase de Krea, `text-accent`, dans la colonne de texte ; singulier « 1 contenu a dépassé sa date… / Le voir ».
- D1/D2. `late=1` compté dans `hasFilters`, état vide dédié « Rien en retard. Tout ce qui a une date est sorti. » sans bouton de création ; pastille neutre « En retard × » avant « Effacer les filtres ».
- E1/E2/E3. Planning filtré « non lus » tous mois confondus, pastille « Non lus × », état vide « Tout est lu. Rien n'attend ta réponse. » + « Voir tout le planning → » ; sur le tableau de bord le lien est une valeur (« 3 non lus → »), inerte « Tout est lu » à zéro.
- P1. Badge « ✨ Auto » et son wrapper retirés ; aide « Le bouton en haut de la fiche fait avancer ton contenu ; ici, tu corriges à la main. »
- T1. Mois de la date en `text-xs` (plus de 9 px) ; pastilles Prêt / À préparer sur les jetons de statut (`status-live`, `status-filming`), lisibles dans les deux thèmes.

Livré en v99 ; migration 0058 à jouer après le déploiement, vérification `supabase/checks/verify_0058.sql`.
