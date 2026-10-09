# Parcours utilisateur — Kreatly, un mardi matin

**Date :** 2026-10-09
**Auteur :** sous-agent `parcours-utilisateur` (`.claude/agents/parcours-utilisateur.md`), première exécution.
**Méthode :** rejouer la journée de trois personnes (consultante, éditrice, client invité) sur le code réel — routes `app/(app)/`, `lib/nav.ts`, `lib/constants.ts`, `lib/krea.ts`, `lib/krea-tours.ts`, migrations 0043→0057, section « Décisions importantes » de `CLAUDE.md`, `review/`, `import/`, `components/content-detail/`, `components/ideas-board.tsx`, `lib/email.ts`, `contents/actions.ts`, cloche, commentaires, copilote, middleware, `messages/fr.json`. Quatre constats clés re-vérifiés à la main (middleware sans `next`, `createTask` sur la marque active, `sendEmail` seulement dans `review/actions.ts`, `isReady` sur le statut seul).
**Statut :** lecture seule — **rien n'a été construit**. Mariam tranche ; chaque proposition retenue passe par `logique-produit` et `ui-design` avant le code.

> Légende effort : **petit** = outil/action existant à brancher · **moyen** = un écran ou une section · **gros** = table + RPC + écran.

---

## 1. Les trois journées

### A. La consultante (owner/admin) — Mariam, marque « Adala » active, 3 marques en tout

| Étape | Écran (fichier) | Gestes | Ce qui coince |
|---|---|---|---|
| 1. Ouvre l'app | Tableau de bord de la marque du cookie `active_brand` (`app/(app)/dashboard/page.tsx`, `lib/brand.ts`) | 0 | Tout est par marque ; seule la cloche est multi-marques (0056). |
| 2. Lit la note de Krea, les 4 chiffres, « Prochainement » (7 jours), « Commentaires » | `dashboard/page.tsx`, `lib/krea-notes.ts` | 0 | « Prêt » = `status !== idea && !== design` (`isReady`) : un reel en « Script » sans une ligne est « Prêt ». La liste commence à aujourd'hui (`.gte("date", todayISO)`) : ce qui est daté d'hier et pas sorti n'apparaît nulle part. |
| 3. Change de marque | `components/brand-switcher.tsx` → `switchBrand` | 2 | — |
| 4. Planifie le mois (12 contenus) | Calendrier → « Nouveau contenu » (`components/new-content-modal.tsx`) : format, plateforme, titre, date → `createContent` redirige vers la fiche | 5–6 **par contenu**, retour calendrier à chaque fois | 12 allers-retours. L'import (`app/(app)/import/`) ne vaut que si la liste est déjà écrite ; Krea crée un contenu par message. Le `share_pct` qu'elle saisit sur chaque thème (`brands/[id]/pillar-manager.tsx`) n'est lu par rien d'autre que son affichage. |
| 5. Sort une idée vers le calendrier | Onglet Idées → « Planifier » (format + plateforme + date) (`components/ideas-board.tsx` `ScheduleDialog`) | 4 | — |
| 6. Prépare un contenu | Fiche : Plan → Script (« Générer », trames) → Storyboard (« Découper », setups, « Marquer comme filmée ») → Légende (« Générer », « Copier ») (`components/content-detail/*`) | 1 par bloc + Enregistrer | Le badge « ✨ Auto » du statut (`plan-tab.tsx`) promet une progression dont deux règles sur quatre lisent `script_ready`/`edited`, écrits seulement par `checklist-tab.tsx` — onglet retiré (`detail-tabs.tsx`). |
| 7. Envoie au client | « Envoyer au client » dans l'en-tête (`submit-review-button.tsx`) → RPC `submit_for_review` + e-mail (`review/actions.ts`) | 1 | Aucun garde : un carrousel sans visuel ni légende part ; si la marque n'a pas encore de client invité, `audience()` renvoie `to: []`, rien ne part, et le bouton affiche quand même « Chez le client ». |
| 8. Invite le client (première fois) | Marque → Équipe → « Créer un lien » → copier (`brands/[id]/team-section.tsx`, `team-actions.ts`) | 4, puis **sortie de l'app** | Le lien part par WhatsApp/mail à la main ; `sendEmail(` n'existe que dans `review/actions.ts` (2 appels). |
| 9. Reçoit « Modification demandée » | E-mail (CTA `/content/{id}`) ou cloche → fiche → remarques ancrées diapo par diapo (`content-tab.tsx` `CommentButton media`) → tiroir (`comments-drawer.tsx`) → corrige → « Envoyer au client » | 3–4 | Le lien e-mail ouvre la fiche sous la **marque active**, pas celle du contenu (`content/[id]/page.tsx` lit `resolveActiveBrand()` ; seule la cloche bascule, `notifications-bell.tsx handleClick`). Sa réponse au client ne déclenche aucun e-mail. |
| 10. Reçoit « validé — pense à le programmer » | Cloche `ready_to_schedule` (0046) → fiche → Plan → menu Statut → « Programmé » → Enregistrer | 5 | Pas de bouton ; si elle oublie, le contenu ne passera jamais « Live » (`recompute_live_statuses` ne bascule que `programmed`/`scheduled`). « Ajouter à mes tâches » crée la tâche sur la marque **active** (`tasks/actions.ts createTask` → `brand_id: active?.id`), pas celle du contenu. |
| 11. Publie sur Instagram | Légende → « Copier » (`caption-tab.tsx`) ; visuels depuis Canva | 2 + **hors app** | Assumé : Krea dit elle-même ne pas publier (`lib/krea.ts` persona). `meta_connections` existe en base (0025/0033) mais « aucune fonctionnalité app ne lit encore cette table » (0033). |
| 12. Le contenu passe « Live » | À la lecture, `recompute_live_statuses` (0041/0045) | 0 | — (bonne nouvelle : pas de tâche de fond, et ça marche). |
| 13. Mesure (3 contenus publiés hier, × 3 marques) | Fiche → onglet Performances (visible seulement si live, `detail-tabs.tsx isPublished`) → 6 chiffres + URL → Enregistrer (`performance-tab.tsx`) | 6 **par contenu**, + lecture des insights Instagram **hors app** | `/analytics` est en lecture seule ; la note de Krea réclame des chiffres (`analyticsNote`) sans endroit pour les saisir en série. |
| 14. Lit « Résultats » | `app/(app)/analytics/page.tsx` + note « Refais-en un cette semaine » | 1 | La note ne propose aucun geste (texte seul). |
| 15. Recommence le mois suivant | Retour étape 4 | idem | `duplicateContent` existe (menu ⋮ de la carte, `content-card.tsx`) mais un par un et sans date ; rien ne rejoue un mois. |

### B. L'éditrice (editor) — Maryem, 2 marques, 2 scripts à écrire, 1 reel à monter, 1 carrousel à préparer

| Étape | Écran (fichier) | Gestes | Ce qui coince |
|---|---|---|---|
| 1. Ouvre l'app | Tableau de bord de la dernière marque | 0 | Rien ne lui dit « ce qui m'est assigné, toutes marques » : `tasks/page.tsx` filtre `.eq("brand_id", active.id)`. |
| 2. Regarde ses tâches | `/tasks` (`components/tasks/tasks-board.tsx`) : cartes assignées, lien vers le contenu (`task.content_id`), glisse « En cours » | 1–2 | Une par marque ; elle doit changer de marque pour voir l'autre tableau. |
| 3. Écrit un script | Fiche → Script : « Générer » (Gemini) ou trames cliquables → Enregistrer (`script-tab.tsx`) | 2–3 | — |
| 4. Prépare le tournage | Storyboard : « Découper en storyboard », setups de la marque, photo par scène, « Marquer comme filmée » (`storyboard-tab.tsx`) | 1 par scène | — (bonne nouvelle : les setups avec matériel (0051) évitent de redécrire le lieu). |
| 5. Tourne un vlog | Onglet Vlog → moments à filmer cochables sur mobile (`capture-checklist.tsx`) | 1 par moment | — |
| 6. Monte un carrousel | Onglet Contenu : « + Slide » un par un, glisser pour ordonner, légende (`content-tab.tsx`, `components/ui/image-upload.tsx` sans `multiple`) | 1 par visuel | Dix diapos = dix envois ; acceptable, mais pas de multi-sélection. |
| 7. Dit que c'est fini | Plan → Statut « Montage »/« Validé » → Enregistrer | 4 | Même friction que la consultante (étape A10) ; l'autre chemin (menu ⋮) n'existe que sur le tableau de bord (`content-card.tsx quickChangeStatus`). |
| 8. Envoie au client | « Envoyer au client » (un editor est `is_brand_writer`, 0052) | 1 | Elle ne sait pas si la marque a un client invité (la section Équipe est sur la page de marque, qu'elle peut voir mais pas gérer). |
| 9. Reçoit une remarque client | Cloche → « Ouvrir dans {marque} » bascule (0056) | 1 | — |
| 10. Demande à Krea « C'est quoi la prochaine étape ? » | Suggestion du panneau (`components/krea/krea-copilot.tsx` `SUGGESTIONS`) | 1 | Le contexte de Krea (`krea-actions.ts buildContext`) ne contient ni statuts, ni tâches, ni ce qui attend chez le client : elle ne peut répondre qu'en général. |
| 11. Demande à Krea d'écrire la légende d'un post | `rediger_script` → « Ce format n'a pas de script — c'est une légende et des visuels, à remplir dans la fiche » (`krea-actions.ts writeScript`) | 1 | Le générateur de légende existe (`aiGenerateCaption`, `ai-actions.ts`) mais Krea n'y a pas accès. |
| 12. Coche « Fait » en fin de journée | `/tasks` | 1 | — |

### C. Le client invité (viewer) — reçoit « Adala — à valider : … »

| Étape | Écran (fichier) | Gestes | Ce qui coince |
|---|---|---|---|
| 1. Reçoit l'e-mail | `renderEmail`, CTA `/review?c={id}` (`review/actions.ts submitForReview`) | 1 | — |
| 2. N'est pas connecté (téléphone, nouveau navigateur) | Middleware → `url.pathname = "/login"` sans `next` (`lib/supabase/middleware.ts`) → après connexion `/dashboard` → `/calendar` | 3 | Le lien perd sa cible alors que `components/auth/auth-shell.tsx` sait lire `?next=`. Il doit retrouver le contenu via la bannière. |
| 3. Première fois : lien d'invitation reçu par WhatsApp | `/invite/{token}` → « Créer un compte » (`?next=/invite/…`) → nom, e-mail, mot de passe → (prod : confirmation e-mail, décision 19 `CLAUDE.md`) → retour → « Accepter l'invitation » → `/dashboard` → `/calendar` | 6–8 | Après l'inscription il doit encore cliquer « Accepter » (`app/invite/[token]/accept-form.tsx`). Le rôle qu'on lui annonce est décrit « Consulter uniquement (lecture seule) » (`messages/fr.json team.roleDescriptions.viewer`) alors qu'il valide et commente. |
| 4. Arrive sur le calendrier | Bannière « X contenus attendent ton avis » → « Les voir » (`calendar/page.tsx`, `isClient`) | 1 | — |
| 5. Valide | `/review` (`review/page.tsx`, `review-deck.tsx`) : diapos numérotées, remarque par diapo, légende, « Je valide » / « Je demande une modif' », zone collante sur téléphone | 1–3 | — (bonne nouvelle : c'est l'écran le plus abouti de l'app, visite guidée comprise). |
| 6. Doit valider un reel | Même page : il lit le **script** (`reel_details.script_full` / `vlog_details.voiceover`) | 1 | Il ne verra jamais la vidéo montée : `review/page.tsx` ne charge que `content_media` et le texte ; `video_url` ne se saisit qu'après publication (`performance-publications.tsx`). La vidéo circule par WhatsApp/Drive. |
| 7. Enchaîne | « Suivant (n) » → « Tout est passé en revue » | 1 | — |
| 8. L'équipe lui répond | Cloche seulement (trigger `notify_brand_on_comment`, 0057) | — | Pas d'e-mail ; `lib/email.ts` dit pourtant que « pour un client qui ouvre Kreatly une fois par semaine, [la cloche] c'est l'équivalent de rien ». |
| 9. Le contenu corrigé revient | E-mail à nouveau, fil des remarques visible sous chaque diapo (0057) | 1 | — |
| 10. Clique un contenu du calendrier | `/content/{id}` → redirigé `/review?c={id}` → « Ce contenu n'attend pas ton avis. » | 1 | — |
| 11. Regarde où en est son mois | Calendrier avec libellés client (`clientStatusLabel`) | 0 | — |
| 12. Profil | Nom, langue, thème ; pas de Krea (layout) | — | — (décision respectée). |

---

## 2. Les constats

### Friction

1. **Planifier un mois, c'est douze fois la même modale.** `createContent` (`contents/actions.ts`) redirige vers la fiche à chaque création ; Krea crée un contenu par message ; l'import exige une liste déjà rédigée. Le `share_pct` des thèmes (`pillar-manager.tsx`, `theme-assistant.tsx`) n'est lu par aucune logique de planification (affichage/édition seulement).
2. **« Validé » → « Programmé » me coûte cinq gestes, et si j'oublie, rien ne sort jamais.** Seul chemin sur la fiche : `plan-tab.tsx` menu Statut + Enregistrer ; la notification « pense à le programmer » (0046) n'a pas d'action ; `recompute_live_statuses` ne bascule que `programmed`/`scheduled`.
3. **Le lien de l'e-mail que reçoit mon client ne l'amène pas au contenu s'il n'est pas connecté.** `lib/supabase/middleware.ts` remplace le chemin par `/login` sans poser `next` ; `auth-shell.tsx` sait pourtant l'utiliser.
4. **Le lien de l'e-mail que je reçois ouvre le contenu sous la mauvaise marque.** `review/actions.ts` envoie vers `/content/{id}` ; `content/[id]/page.tsx` prend rôle et interrupteur IA de `resolveActiveBrand()` ; la bascule n'existe que dans la cloche (`notifications-bell.tsx handleClick`, 0056).
5. **« Ajouter à mes tâches » met la tâche sur le mauvais tableau.** `notifications-bell.tsx handleAddTask` → `createTask` → `tasks/actions.ts` pose `brand_id: active?.id`, sans basculer sur la marque de la notification.
6. **« Prêt » me rassure à tort.** `dashboard/page.tsx isReady` ne regarde que le statut ; un reel passé en « Script » par l'onglet Idées (`ideas-actions.ts writingStatusFor`) est « Prêt » avec un script vide.
7. **Mes tâches sont éparpillées par marque.** `tasks/page.tsx` filtre sur la marque active ; la cloche, elle, est multi-marques (0056). Pour Maryem c'est N tableaux à visiter.
8. **Mon client s'inscrit, puis doit encore accepter.** `/invite/[token]` après `register(next=/invite/…)` réaffiche la page avec « Accepter l'invitation » (`accept-form.tsx`) ; en prod, la confirmation d'e-mail (décision 19) ajoute un aller-retour.
9. **Des mots que la cible ne parle pas** — à passer à `ui-design` comme passe de libellés, pas comme fonctionnalité : « Client » décrit « Consulter uniquement (lecture seule) » (`fr.json team.roleDescriptions.viewer`, faux depuis 0052) ; « Pilier » encore dans `planning-table.tsx` (en-tête), `fr.json dashboard.miniAnalytics.highlightPillar`, `analytics.pillarRanking`, `brandDetail.pillars`, alors que la fiche et la page de marque disent « Thèmes » ; « Outro », « CTA » (`script-tab.tsx REEL_BLOCKS`, `constants.ts SCENE_TAGS`), « Storyboard », « Design », « Live », « Brouillons » (`fr.json dashboard.kpi.drafts`), « Setups de tournage » (page de marque) vs « lieux de tournage » (visite guidée).

### Trou

10. **Rien ne me dit ce qui est en retard.** Aucun « retard/overdue » fonctionnel dans le code ; « Prochainement » part d'aujourd'hui ; un reel en « Montage » daté d'hier n'est ni Live (règle 0041 limitée à programmed/scheduled) ni signalé.
11. **Je peux envoyer au client un contenu vide, ou l'envoyer à personne.** `submit_for_review` (0052) ne vérifie rien ; `review-deck.tsx` prévoit le message « n'a pas encore de visuel ni de texte à regarder » ; sans membre `viewer`, `audience()` renvoie une liste vide, `sendEmail` renvoie 0 en silence, le bouton passe quand même à « Chez le client ».
12. **Mon client valide un script, jamais la vidéo montée.** `review/page.tsx` charge `content_media`, `reel_details.script_full`, `vlog_details.voiceover` ; aucun lecteur, aucun lien ; `contents.video_url` (0017) est l'URL *publiée*, saisie après coup. La vidéo part par WhatsApp/Drive — c'est aussi un Hors-app.
13. **Quand je réponds à mon client, il ne le saura qu'en ouvrant l'app.** `sendEmail(` n'est appelé que dans `review/actions.ts` (deux fois) ; `replyToComment` (`comment-actions.ts`) ne fait que l'insert ; le trigger 0057 ne crée qu'une notification.
14. **Le statut « ✨ Auto » est à moitié mort.** Badge dans `plan-tab.tsx` ; `recompute_content_status` (0015) : règle 1 (`script_ready`) et règle 4 (`edited`) ne sont écrites que par `checklist-tab.tsx`, retiré de `detail-tabs.tsx` ; la RPC ne connaît ni `approved` ni `live` (rangs jusqu'à `published`). Seul « ≥ 1 scène filmée → Tournage » fonctionne encore.
15. **Krea ne sait ni écrire une légende, ni planifier, ni me dire où j'en suis.** `KREA_TOOLS` (`lib/krea.ts`) = `creer_contenu`, `rediger_script`, `ouvrir_page` ; `rediger_script` refuse post/carrousel alors que `aiGenerateCaption` existe (`ai-actions.ts`) ; `scheduleIdea` existe (`ideas-actions.ts`) mais pas d'outil ; `ouvrir_page` ignore Idées, À valider, Import ; `buildContext` n'a ni statuts ni tâches, donc la suggestion « C'est quoi la prochaine étape ? » ne peut pas s'appuyer sur des faits.

### Hors-app

16. **Mesurer, c'est recopier Instagram chiffre par chiffre, fiche par fiche, marque par marque.** `performance-tab.tsx` (6 champs + Enregistrer), onglet caché avant « Live » (`detail-tabs.tsx`), `/analytics` sans aucun champ ; la note Krea demande ces chiffres (`lib/krea-notes.ts analyticsNote`).
17. **Publier se fait ailleurs.** « Copier » la légende (`caption-tab.tsx`) puis Instagram ; `meta_connections` dort (0033). Assumé par le produit (persona Krea) — constat, pas proposition.
18. **Inviter, c'est copier un lien et l'envoyer soi-même.** `team-section.tsx InviteDialog` (« Copie-le et envoie-le ») ; aucun e-mail d'invitation.

### Doublon

19. **Deux chemins pour changer un statut, aucun là où j'en ai besoin.** Menu Statut du Plan (`plan-tab.tsx`) et menu ⋮ des cartes du tableau de bord (`content-card.tsx`) ; rien dans l'en-tête de la fiche ni sur le calendrier/planning.
20. **Trois portes vers les commentaires, dont une qui ne mène pas aux commentaires.** Tiroir de la fiche (`comments-drawer.tsx`), bouton par carte calendrier/planning (`content-comments-button.tsx`), et carte « Commentaires » du tableau de bord dont « Voir tout » ouvre `/calendar?view=planning` (`dashboard/page.tsx`).

---

## 3. Les propositions (par ce qu'elles font gagner)

**P1. La prochaine étape en un bouton, dans l'en-tête de la fiche** — constats 2, 19, 14
Quand un contenu est validé, je vois « C'est programmé » à la place de « Envoyer au client » ; quand c'est posté, « C'est en ligne » et je colle l'URL. Un geste au lieu de cinq, et je ne rate plus jamais le passage en Live.
Réutilise : `quickChangeStatus`, `updatePublication({ url })`, l'emplacement `data-tour="content-review"` et le motif de `SubmitReviewButton` (un bouton qui change avec le statut), la notification `ready_to_schedule` qui se marque lue toute seule (0046).
Effort : **petit** (actions existantes, un composant d'en-tête). Dans la foulée, retirer le badge « ✨ Auto » (`plan-tab.tsx`) plutôt que ranimer la checklist.
`logique-produit` : quel statut exact par format (`programmed` vs `scheduled`), interaction avec `auto_status` et `recompute_live_statuses` (date+heure nécessaires pour le Live automatique — si pas de date, « C'est en ligne » doit poser `live` directement). `ui-design` : l'en-tête porte déjà cinq actions ; un seul bouton « étape suivante » qui remplace « Envoyer au client », pas un sixième.

**P2. Ce qui traverse les marques arrive au bon endroit** — constats 3, 4, 5, 7
Le lien de l'e-mail amène mon client sur le contenu même s'il doit se connecter ; le mien ouvre la fiche sous la bonne marque ; « Ajouter à mes tâches » tombe sur le bon tableau ; et sur `/tasks`, un interrupteur « Toutes mes marques » me liste ce qui m'est assigné partout.
Réutilise : `safeNext`/`auth-shell.tsx` (poser `next` dans le middleware), `switchBrand` (déjà appelé par la cloche), la pastille « Ouvrir dans {marque} » de `notifications-bell.tsx`, la policy `tasks_select` (0049 : un membre lit les tâches de toutes ses marques — une requête sans filtre `brand_id` suffit), `brands` de `resolveActiveBrand`.
Effort : **petit** ×4 (une ligne de middleware ; `brandId` passé à `createTask` ; pour la fiche, soit bannière « Tu es sur Adala — basculer » avec `switchBrand`, soit dériver rôle/IA de `content.brand_id` ; une liste plate sur `/tasks`).
`logique-produit` : un cookie ne s'écrit pas pendant le rendu d'un Server Component — choisir bannière+action ou dérivation depuis `content.brand_id` ; la vue « toutes marques » est une liste, pas un second tableau. `ui-design` : pastille de marque sur chaque tâche, interrupteur à côté du titre, rien de plus.

**P3. Avant d'envoyer au client, l'app vérifie** — constat 11
Si la marque n'a pas de client invité, le bouton dit « Invite d'abord ton client » et m'emmène à l'Équipe ; si le contenu n'a ni visuel ni texte, il dit « Ajoute un visuel ou une légende d'abord ». Je n'envoie plus un e-mail dans le vide, ni une page vide.
Réutilise : `list_brand_members_with_emails` (déjà appelé par `audience()`), `content_media`/`reel_details`/`vlog_details` (déjà lus par `review/page.tsx`), l'ancre `brand-team` de la page de marque.
Effort : **petit** (deux tests dans `submitForReview` + état du bouton avec raison).
`logique-produit` : garder possible la relecture interne avant client (voulue : `nav.ts`, RPC 0052) — le garde porte sur l'envoi, pas sur `/review`. `ui-design` : bouton désactivé avec la raison en texte sous lui, pas une infobulle (téléphone).

**P4. Mon client reçoit un e-mail quand je lui réponds, et son invitation part de l'app** — constats 13, 18, 8
Quand je réponds sous sa remarque, il reçoit « L'équipe t'a répondu » avec le lien vers `/review?c=…` ; et dans « Créer un lien », un champ e-mail facultatif envoie l'invitation à sa place de moi. Le lien reste copiable comme aujourd'hui.
Réutilise : `lib/email.ts` (`renderEmail`, `sendEmail`, `replyTo`, nom « {Marque} via Kreatly »), `audience()` de `review/actions.ts`, `replyToComment` (sait qui est l'auteur du fil parent), `create_brand_invitation` (0008/0043).
Effort : **petit** (deux appels d'e-mail, un champ dans `InviteDialog`).
`logique-produit` : quota Resend 3 000/mois partagé entre projets — n'envoyer que lorsque l'auteur du fil parent est un `viewer`, une fois par réponse, jamais pour les échanges internes ; l'adresse saisie dans l'invitation n'est pas stockée au-delà de l'envoi. `ui-design` : le champ e-mail en option sous le rôle, le lien copiable toujours visible après.

**P5. Les chiffres du mois, en une seule page** — constat 16
Sur « Résultats », une liste des contenus en ligne du mois, avec vues/likes/partages et l'URL à remplir ligne par ligne, enregistrés au fur et à mesure. Je fais le tour d'une marque en deux minutes au lieu d'ouvrir chaque fiche.
Réutilise : `upsertPerformance` et `updatePublication` (autosave sur blur, déjà le motif de `publications-editor.tsx`), `fetchThumbnails` pour la vignette, le filtre mois du calendrier, la note Krea de `/analytics` qui réclame précisément ces chiffres.
Effort : **moyen** (une section/écran, zéro table ni RPC).
`logique-produit` : écriture réservée à `is_brand_writer` (un client voit les chiffres, ne les saisit pas — 0053) ; périmètre = contenus `live` du mois affiché. `ui-design` : six chiffres par ligne ne tiennent pas en largeur de téléphone — une carte par contenu avec les champs en grille 2×3, et la vignette pour reconnaître le contenu.

**P6. Le retard et le « vraiment prêt » dits par Krea** — constats 10, 6
Sur le tableau de bord, Krea me dit « 2 contenus ont dépassé leur date sans sortir » avec un lien vers la liste filtrée ; et « Prêt » ne s'affiche que si le script ou les visuels existent vraiment.
Réutilise : `dashboardNote` (`lib/krea-notes.ts`, logique pure et testée — une règle de plus), les filtres d'URL du tableau de bord (`dashboard-filters.tsx`), le motif de requêtes groupées de `lib/thumbnails.ts` pour compter scripts/visuels des contenus affichés.
Effort : **petit** (la note) + **petit/moyen** (le « prêt » réel).
`logique-produit` : définir « en retard » (date < aujourd'hui et statut hors `live`/`approved`/`programmed`/`scheduled`/`pending_review` ?) et « prêt » par format (reel : `script_full` non vide ; post/carrousel : ≥ 1 visuel) ; tout calculé à la lecture, pas de tâche de fond. `ui-design` : une seule note, ton « push », pas de rouge sur tout le tableau.

**P7. Krea apprend trois gestes et connaît l'état du mois** — constat 15
Je lui dis « écris la légende de ce post » et elle l'écrit ; « planifie-le jeudi sur Instagram » et elle le fait ; « où j'en suis ? » et elle répond avec les vrais chiffres : ce qui attend chez le client, ce qui est validé mais pas programmé, ce qui est en retard.
Réutilise : `aiGenerateCaption` (outil `rediger_legende`), `scheduleIdea`/`addPublication` (outil `planifier_contenu`), `ouvrir_page` étendu à `idees`, `a-valider`, `import`, `profil` ; `buildContext` enrichi de quatre comptes par statut (une requête `select status` déjà faite par le tableau de bord) ; `DeedCard` pour montrer ce qu'elle a fait.
Effort : **petit** (outils à brancher) à **moyen** (contexte + cartes).
`logique-produit` : Krea n'écrase jamais une légende existante (règle de la persona) — écrire seulement si vide, sinon proposer dans le fil ; pas d'outil `envoyer_au_client` (effet e-mail irréversible) ni de suppression. `ui-design` : nouvelles `DeedCard` « Légende écrite », « Planifié le … » dans le même gabarit.

**P8. La vidéo montée, à valider avant de sortir** — constat 12
Pour un reel ou un vlog, je colle le lien de la vidéo montée (WeTransfer, YouTube non répertorié, Drive) et mon client la regarde sur sa page de validation, au-dessus du script. Il valide ce qui sera réellement posté.
Réutilise : `review-deck.tsx` (bloc Script existant), `review/page.tsx` (déjà deux requêtes groupées pour reel/vlog), la zone « Publications » du Plan.
Effort : **moyen** (une colonne, un champ dans la fiche, un bloc dans la validation) — **gros** si l'on héberge le fichier (free tier Supabase, poids).
`logique-produit` : un lien n'est pas du stockage (la décision « pas de Drive » vise l'hébergement) ; ne pas détourner `contents.video_url` (0017 = URL publiée, lue par l'analytics) — nouvelle colonne ; qui peut poser le lien (writer). `ui-design` : lien sortant avec aperçu simple, pas de lecteur embarqué dépendant du service.

**P9. Préparer le mois en une fois** — constats 1, 15
Depuis un calendrier vide, « Préparer le mois » me propose douze cases réparties selon mes thèmes et leur part, à ma cadence, titrées à partir des exemples de chaque thème ; je décoche, je renomme, je crée. Krea peut faire la même chose quand je lui dis « prépare-moi octobre ».
Réutilise : `spreadDates` et l'aperçu avant création de `import-form.tsx`, les trois insertions groupées de `importSeries`, `brand_pillars.share_pct` et `examples` (enfin lus), `creer_contenu` de Krea pour la variante conversationnelle.
Effort : **moyen** (réemploi de l'import, pas de table).
`logique-produit` : ce qui est créé = idées datées en « Retenue »/« Script » ou sans date ? titre par défaut quand un thème n'a pas d'exemple ; éviter d'inonder une marque qui a déjà un mois rempli (proposer seulement les jours libres). `ui-design` : même écran que l'import (liste à cocher + dates), pour ne pas inventer un second formulaire.

**P10. Une seule porte « Commentaires » sur le tableau de bord** — constat 20
« Voir tout » de la carte Commentaires m'ouvre les commentaires non lus, pas le planning.
Réutilise : `count_unread_comments`, le tiroir en mode `inbox` (`comments-drawer.tsx InboxView`), ou simplement `/calendar?view=planning` **avec** un filtre « non lus » déjà calculé par `commentCounts`.
Effort : **petit**.
`logique-produit` : rien de nouveau. `ui-design` : le lien doit mener à ce qu'il annonce ; sinon, retirer « Voir tout ».

---

## 4. À ne pas faire

- **Publier directement sur Instagram depuis Kreatly.** `meta_connections` dort, le token est sensible (0033), la cible n'est pas une social media manager qui programme vingt comptes ; Krea assume déjà la frontière (« publier sur les réseaux » hors champ). À revoir à la monétisation, pas avant.
- **Un bouton « Télécharger les visuels » pour poster.** Les images sont compressées à 1 200 px à l'envoi (`components/ui/image-upload.tsx`) : ce sont des aperçus, pas les masters ; la source reste Canva. On ferait publier une version dégradée.
- **Un tableau de bord « toutes marques ».** Contraire à « pas de tableau de bord avancé » ; la marque active est le contexte qui sécurise tout (rôle, IA, RLS). La cloche multi-marques (0056) plus la liste de tâches de P2 suffisent.
- **Remettre l'onglet Checklist pour « réparer » l'auto-statut.** Ce serait une étape de plus pour faire vivre un automatisme à moitié mort ; P1 règle le besoin avec un bouton, et le badge « ✨ Auto » peut disparaître.
- **Donner à Krea `envoyer_au_client` ou `supprimer`.** Un e-mail parti chez un client par erreur coûte plus que le geste qu'il économise ; la persona (« elle ne supprime jamais ») tient parce qu'elle est simple.
- **Un grand tour « ta première semaine ».** Décision 19 de `CLAUDE.md` : visites page par page, rien d'enchaîné.
- **Des rappels « ton client n'a pas répondu depuis 3 jours ».** Exigerait une tâche planifiée (interdit : tout se recalcule à la lecture). Au mieux, une note Krea calculée à l'ouverture — déjà couverte par l'esprit de P6.
- **Une boîte de réception des remarques toutes marques.** La cloche fait ce travail depuis 0056 ; un écran de plus pour la même information.
- **Multi-sélection d'images pour le carrousel.** Dix envois pour dix diapos reste acceptable au regard du reste ; à garder pour plus tard, pas en tête de liste.

---

## 5. Arbitrage

_À remplir par Mariam : propositions retenues, écartées, à discuter._
