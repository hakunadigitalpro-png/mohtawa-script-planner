# Chantier 2 — Le contexte de marque

**Date :** 2026-10-12
**Origine :** [PARCOURS-UTILISATEUR.md](PARCOURS-UTILISATEUR.md), constats 3, 4, 5, 7, 11 ; propositions P2, P3.
**Statut :** validé par `logique-produit` et `ui-design` (réserves intégrées, section 6), approuvé par Mariam, **livré en v100** le 2026-10-12. Aucune migration.

---

## 1. Ce qui ne va pas aujourd'hui (vérifié dans le code)

1. **Le lien d'un e-mail perd sa cible si on n'est pas connecté.** `lib/supabase/middleware.ts:52-55` remplace le chemin par `/login` sans poser `next`. Pourtant tout le reste existe : `auth-shell.tsx:21` lit `?next=`, `login/actions.ts:16` le consomme via `safeNext`, `register` aussi. Le client qui ouvre « Voir et valider » sur son téléphone atterrit sur `/dashboard` → `/calendar`, et doit retrouver le contenu par la bannière.
2. **Le lien de l'e-mail que reçoit l'équipe ouvre la fiche sous la marque du cookie.** `content/[id]/page.tsx:70` prend le rôle et l'interrupteur IA de `resolveActiveBrand()` ; le menu latéral, Krea et le calendrier restent sur l'autre marque. Seule la cloche bascule avant d'ouvrir (`notifications-bell.tsx:129-135` → `switchBrand`). Même chose sur `/review?c=` pour un client invité sur plusieurs marques (`review/page.tsx:34`).
3. **« Ajouter à mes tâches » crée la tâche sur la marque active.** `tasks/actions.ts:31` pose `brand_id: active?.id` ; la cloche ne transmet pas `notif.brand_id` (`notifications-bell.tsx:157-161`).
4. **Les tâches sont éparpillées par marque.** `tasks/page.tsx:30` filtre sur la marque active. La policy `tasks_select` (0049) laisse pourtant un membre lire les tâches de toutes ses marques : rien n'empêche une liste, il manque l'écran.
5. **On peut envoyer au client un contenu que personne ne recevra, ou qui n'a rien à montrer.** `submit_for_review` (0052) ne vérifie rien ; `audience()` renvoie `to: []` en silence quand la marque n'a pas de membre `viewer` ; `review-deck.tsx:279` prévoit « Ce contenu n'a pas encore de visuel ni de texte à regarder » — trop tard, l'e-mail est parti.

---

## 2. Le métier : la marque, c'est celle du contenu qu'on regarde

Le cookie `active_brand` mémorise la dernière marque ouverte — c'est utile pour le tableau de bord, le calendrier, les tâches. Mais **quand un lien ouvre un contenu, la marque devient celle du contenu**, sans que la personne ait à le savoir : un e-mail, une notification, une tâche, un lien copié. C'est déjà ce que fait la cloche ; on le fait partout.

Le tableau des tâches reste **par marque** (c'est celui de l'équipe). Mais une personne a des tâches sur plusieurs marques : elle doit pouvoir voir **les siennes, partout**, en une liste.

**Envoyer au client** n'a de sens que si un client existe et s'il y a quelque chose à regarder. Sinon l'app le dit avant, et dit quoi faire.

---

## 3. Ce qu'on construit

### 3.1 Une porte unique pour changer de marque par lien — `app/switch-brand/route.ts`

Un *route handler* `GET /switch-brand?to=<brandId>&next=<chemin>` : vérifie que la personne est membre de `to` (lecture `brand_members` sous RLS), pose le cookie (`setActiveBrandId`, déjà dans `lib/brand.ts`), redirige vers `safeNext(next)`. Pas membre → `/dashboard`.

Pourquoi un handler et pas la page : un Server Component ne peut pas écrire un cookie pendant son rendu. Une bannière « Tu es sur Adala — basculer » ajouterait un clic à chaque lien ; la cloche bascule déjà sans bannière, on fait pareil.

- `content/[id]/page.tsx` : **le contenu d'abord** (la RLS répond ou non), puis si `content.brand_id !== active.id` → `redirect("/switch-brand?to=…&next=/content/{id}?…")`, et **seulement au re-rendu sous la bonne marque** le renvoi d'un `viewer` vers `/review?c=`. Le rôle est par marque (`brand_members`, clé `(brand_id, user_id)`), pas par cookie : une éditrice de Mintandpines qui est cliente d'Adala ne doit pas être traitée en cliente sur un contenu de Mintandpines. Pas membre → la RLS ne renvoie rien → `notFound()` comme aujourd'hui.
- `review/page.tsx` avec `?c=` : le contenu demandé est résolu **par son id, sans filtrer sur la marque active** (aujourd'hui `review/page.tsx:70` filtre, l'`extra` serait toujours vide), puis même bascule.
- **Une seule porte** : tout ce qui *suit un lien vers un contenu* passe par `/switch-brand` — la cloche comprise (elle remplace son appel à `switchBrand` par `router.push("/switch-brand?to=…&next=…")`). `switchBrand` reste pour le choix explicite dans le sélecteur de marque. Les liens des tâches, des e-mails, des commentaires n'ont rien à changer : ils mènent à `/content/{id}`, qui fait le reste.
- `viewer` : `/switch-brand` lui est ouvert — nécessaire pour `/review?c=` sur une autre marque, cohérent avec `members_select_self_or_member` (0001).

Effets : le menu latéral, le rôle, l'interrupteur IA, Krea et « contenu précédent / suivant » sont ceux de la bonne marque. Un cookie posé par un `GET` ne modifie aucune donnée et n'ouvre aucun droit : la marque doit déjà être à soi.

### 3.2 Le lien survit à la connexion — `lib/supabase/middleware.ts`

Quand on renvoie vers `/login`, la recherche est **remplacée** par `?next=<chemin+recherche>` (aujourd'hui l'URL est clonée : `/review?c=X` arrivait sur `/login?c=X`). Dans l'autre sens, la même règle : une personne déjà connectée qui touche `/login?next=…` va vers `safeNext(next)`, pas vers `/dashboard`. `safeNext` (`lib/utils.ts`, importable dans le middleware : il ne dépend que de `clsx`) refuse tout ce qui n'est pas un chemin interne. Après connexion ou inscription, on arrive où le lien le disait ; si c'est un contenu d'une autre marque, 3.1 prend le relais.

### 3.3 La tâche tombe sur la bonne marque, et je vois les miennes partout

- `createTask` accepte `brandId` ; la cloche passe `notif.brand_id` **et `assigneeId: userId`** — le bouton dit « Ajouter à **mes** tâches », la tâche doit donc être à moi, sinon elle n'apparaîtrait jamais dans « Toutes mes marques ». Le bouton « Ajouter » du tableau reste non assigné : là, c'est une tâche d'équipe. La policy `tasks_insert` (0049) exige d'être membre de la marque : rien à ajouter côté marque. (Noté hors périmètre : elle vérifie `is_brand_member`, pas `is_brand_writer` — un `viewer` pourrait insérer une tâche par l'API alors que la page le renvoie ; à resserrer dans une migration à part.)
- `/tasks?all=1` — **« Toutes mes marques »** : une liste plate des tâches **qui me sont assignées et pas faites**, toutes marques (`assignee_id = moi`, `status ≠ done`, `brands(name)` joint), groupée par marque (ordre alphabétique fixe, pour que la liste ne se rebatte pas après un « Fait »). Pas de glisser-déposer, pas d'assignation : c'est une liste, le tableau reste l'endroit où l'on organise.
  - **Une ligne** = trois blocs, même gabarit de carte que le tableau (`rounded-xl border border-border/60 bg-card p-3 shadow-sm`) : la pastille d'urgence **seulement si urgent** (`bg-destructive` + texte lu par les lecteurs d'écran ; rien pour « normal » — quinze points jaunes décoratifs sur quinze lignes ne diraient rien), puis une colonne `min-w-0 flex-1` avec le libellé qui se replie (jamais tronqué) et **dessous** le lien du contenu (tronqué, `text-xs text-accent`, il bascule tout seul, 3.1), puis le bouton « Fait » en `outline` `sm` avec `Check` — un contrôle répété par ligne n'est pas l'action de la page. Attente **par ligne** : le bouton cliqué passe `disabled` + `aria-busy`, `Loader2` remplace `Check`. La pastille de priorité sort dans un `TaskPriorityDot` partagé tableau/liste, pour que sa couleur n'existe qu'à un endroit.
  - **Le groupe** : le nom de la marque dans le style des en-têtes de colonne du tableau (`text-xs font-bold uppercase tracking-wider text-muted`) + compteur ; groupes en `space-y-6`, lignes en `space-y-2`. Jetons seulement : les deux thèmes passent.
  - **Le bandeau dit où l'on est** : en vue « Toutes mes marques », eyebrow « Toutes mes marques », sous-titre « Ce qui t'est assigné, sur toutes tes marques. » ; **la rangée « Ajouter une tâche » n'y est pas** (elle créerait sur la marque active sans le dire — elle vit sur le tableau).
  - **Vide** : « Rien ne t'est assigné pour l'instant. » puis « Les tâches qu'on t'assigne, sur n'importe quelle marque, apparaîtront ici. », dans la boîte en pointillés des états vides de page (`rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted`).
- **Deux onglets « Cette marque » / « Toutes mes marques »** dans le slot `actions` de `PageHeader` avec `actionsClassName="w-full"`, exactement comme les onglets du calendrier (sous le titre, à gauche ; « à côté du titre » se cognerait à un long nom de marque à 400 px). Le dessin `Tab` / `TabIcon` de `calendar-view-tabs.tsx` (avec son attente `useLinkStatus`) est **extrait dans un composant partagé** `components/ui/view-tabs.tsx`, pas recopié : « même dessin » n'est garanti que s'il n'y en a qu'un.
- `viewer` : hors de portée, par le `redirect("/calendar")` existant de `tasks/page.tsx`.

### 3.4 Avant d'envoyer au client, l'app vérifie — `review/actions.ts` + `next-step-button.tsx`

**Une seule règle, `whyNotSendable`, dans `lib/content-lifecycle.ts`** (pure, testée), nourrie par **les mêmes lectures que l'écran de validation** — pas par `hasMaterial` du tableau de bord, qui répond à une autre question (« la matière existe ») et compte des choses que `/review` ne montre pas (une intro de reel, un visuel sans image). Un nouveau chargeur partagé `lib/review-material.ts` (`fetchReviewMaterial`) lit, en requêtes groupées, ce que `/review` affiche : visuels avec image (`content_media`), script (`reel_details.script_full`, `vlog_details.voiceover`), légende. `review/page.tsx` l'utilise à la place de ses requêtes en ligne ; `review-deck.tsx:279` (« rien à regarder ») et le garde disent donc la même chose, par construction.

Elle est appliquée **par tous les chemins**, comme « Programmé exige une date » au chantier 1 : dans `submitForReview` (le bouton), et dans `updateContent` quand `patch.status === "pending_review"` (le menu Statut du Plan, le ⋮ des cartes). Le chemin manuel n'envoie pas d'e-mail, mais il ne doit pas mentir sur l'étape.

**Ce qu'on voit dans l'en-tête quand l'envoi est bloqué : pas un bouton désactivé, une pastille dont le libellé EST l'instruction** — le précédent existe dans le même fichier (`needs_format` → « Choisis d'abord un format »). Un bouton `outline` désactivé sur le bandeau sombre tombe à 2,7:1 et paraît en panne, et ce serait l'état par défaut de toute marque neuve. Aucun texte persistant dans la rangée d'actions : sur grand écran il écraserait le titre et reléguerait les quatre autres contrôles sous une phrase.

| Cas | La pastille (neutre, `h-8`, texte court — sous 300 px à 400 px de large) | Elle se clique ? |
|---|---|---|
| Aucun membre `viewer`, et je suis owner/admin | « Invite d'abord ton client » (`UserPlus`) | **oui** : la pastille est un `Link` vers `/brands/{id}#team`, avec `ArrowRight` en fin et un survol, pour qu'on voie qu'elle se clique |
| Aucun membre `viewer`, et je suis editor | « Demande à l'admin d'inviter ton client » | non |
| reel / vlog sans script | « Écris d'abord le script » (`FileText`) | non |
| post / carrousel / infographie sans visuel ni légende | « Ajoute un visuel ou une légende » (`Image`) | non |
| story sans diapo illustrée | « Ajoute une diapo avec son image » | non |

La pastille garde `data-tour="content-review"`. `NextStepButton` reçoit `brandId` et `canInvite` (la page a `content.brand_id` et `role`). Le Card « Équipe » de la page de marque reçoit `id="team"` **et `scroll-mt-20`**, sinon sur téléphone le titre « Équipe » atterrit sous la barre collante de 56 px.

**Les stories** : `/review` ne charge aujourd'hui ni leurs diapos ni leurs images — un client ne pouvait pas en valider une. `fetchReviewMaterial` lit aussi `story_slides` (image → visuel, texte → script « Diapo 1 : … »), et l'écran de validation les montre comme un carrousel. Sans ça, le garde bloquerait toute story pour toujours.

Les membres : `list_brand_members_with_emails` (déjà appelée par `audience()`), lue une fois par la page et une fois par l'action.

L'envoi redevient un bouton orange dès que c'est réglé ; `/review` reste ouvert à l'équipe pour relire (`lib/nav.ts`, 0052).

### 3.5 Documentation

- `docs/06-content-lifecycle.md` : le garde avant l'envoi.
- `docs/04-user-roles.md` : « la marque suit le contenu » et la porte `/switch-brand`.
- ADR `docs/decisions/2026-10-12-la-marque-suit-le-contenu.md` ; `CLAUDE.md` décision 23.
- Libellés fr/en/ar : les deux pastilles, l'état vide, les raisons du garde, le lien « Inviter ton client ».

---

## 4. Ordre de livraison

1. `/switch-brand` + fiche + `/review` (3.1) et le `next` du middleware (3.2).
2. Tâches : `brandId` + liste « Toutes mes marques » (3.3).
3. Le garde avant l'envoi (3.4).
4. Docs.

Effort : **petit** ×4 — aucune table, aucune migration, un handler, une liste, un garde.

---

## 5. Points soumis aux gardiens

À `logique-produit` :
- Basculer **automatiquement** sur la marque du contenu (3.1) plutôt qu'une bannière : c'est ce que fait déjà la cloche ; un `GET` qui pose un cookie de marque dont on est membre n'est pas une mutation.
- « Toutes mes marques » = assignées à moi, pas faites. Les tâches non assignées de mes marques n'y sont pas (elles sont « à l'équipe », sur chaque tableau).
- Le garde bloque **l'envoi**, pas `/review` : l'équipe peut toujours relire par l'URL. Un contenu sans format est déjà traité par le bouton (« Choisis d'abord un format », chantier 1) ; ici on ne bloque que « rien à regarder ».
- Un client invité sur deux marques et `/review?c=` : bascule aussi.

À `ui-design` :
- L'envoi bloqué : une pastille-instruction neutre (cliquable vers l'équipe pour owner/admin), jamais un bouton désactivé ni un texte dans la rangée d'actions.
- Les deux onglets « Cette marque / Toutes mes marques » (composant partagé avec le calendrier) et la liste plate (groupe par marque, ligne = urgence + libellé + lien dessous + « Fait » en `outline`), tenue à 400 px.
- Le bandeau en vue « Toutes mes marques » et l'absence de la rangée d'ajout.
- L'état vide de la liste.

---

## 6. Verdicts

**`logique-produit` — ⚠️ Cohérent avec réserves**, toutes intégrées dans la section 3 :

- A. « Rien à regarder » n'était pas la règle de `/review` : `hasMaterial` compte une intro de reel, des diapos de story jamais affichées, un visuel sans image. → Une règle pure `whyNotSendable`, nourrie par un chargeur partagé avec `/review` (`fetchReviewMaterial`) ; `/review` apprend à montrer les stories, sinon le garde les bloquerait pour toujours.
- B. Le garde vaut par tous les chemins : `updateContent({ status: "pending_review" })` l'applique aussi, comme `whyNotProgrammed`.
- C. Sur la fiche, le contenu se charge **avant** le renvoi du `viewer` ; la bascule d'abord, le rôle de la bonne marque ensuite. Sur `/review?c=`, le contenu demandé est résolu par son id sans filtre de marque.
- D. « Ajouter à mes tâches » assigne la tâche à moi (`assigneeId`), sinon elle n'apparaîtrait jamais dans « Toutes mes marques ».
- E. Une seule porte pour suivre un lien : la cloche passe aussi par `/switch-brand` ; `switchBrand` reste au sélecteur.
- F. Le middleware **remplace** la recherche par `?next=` (au lieu de la cloner), et renvoie une personne déjà connectée sur `/login?next=` vers `next`.
- G. Décisions `viewer` écrites : `/switch-brand` ouvert ; `/tasks?all=1` hors de portée. Noté hors périmètre : `tasks_insert` (0049) vérifie `is_brand_member` et non `is_brand_writer`.

**`ui-design` — ❌ Refusé en première lecture**, sur le dessin du bouton bloqué et de l'état vide ; toutes les corrections sont intégrées dans la section 3 :

- P1/P2. Un bouton `outline` désactivé sur le bandeau sombre (2,7:1) paraît en panne, et une phrase persistante dans la rangée d'actions écrase le titre sur grand écran. → Une **pastille-instruction** neutre (comme « Choisis d'abord un format »), cliquable vers `/brands/{id}#team` pour owner/admin, statique sinon ; libellés courts ; rien d'autre dans la rangée. `NextStepButton` reçoit `brandId` et `canInvite`.
- P3. `#team` atterrissait sous la barre mobile collante → `scroll-mt-20` sur le Card.
- (b) Les onglets vont dans le slot `actions` de `PageHeader` (`w-full`), comme le calendrier ; `Tab`/`TabIcon` extraits dans `components/ui/view-tabs.tsx`, pas recopiés.
- P4. En vue « Toutes mes marques », le bandeau le dit (eyebrow, sous-titre) et la rangée « Ajouter une tâche » disparaît.
- P5. « Fait » en `outline` `sm` + `Check`, attente par ligne (`Loader2`) ; ligne = urgence · libellé replié + lien dessous · bouton ; groupe = en-tête de colonne + compteur ; ordre alphabétique.
- P6 (réserve). Dans la liste, la pastille n'apparaît que pour « urgent » ; `TaskPriorityDot` partagé.
- P7. État vide : « Rien ne t'est assigné pour l'instant. » + « Les tâches qu'on t'assigne, sur n'importe quelle marque, apparaîtront ici. », boîte en pointillés des états vides de page.
