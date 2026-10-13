# Chantier 3 — Qui prévient qui

**Date :** 2026-10-13
**Origine :** [PARCOURS-UTILISATEUR.md](PARCOURS-UTILISATEUR.md), constats 13, 18, 8 ; proposition P4.
**Statut :** approuvé par Mariam, codé le 2026-10-13 (v101). Les gardiens passent une seule fois, à la fin, sur le diff (section 6).

---

## 1. Ce qui ne va pas aujourd'hui (vérifié dans le code)

1. **Quand l'équipe répond à une remarque du client, il ne le saura qu'en ouvrant l'app.** `replyToComment` (`app/(app)/contents/comment-actions.ts:53-94`) insère la réponse et s'arrête là. Le trigger 0057 crée une notification dans la cloche — mais `lib/email.ts` le dit lui-même : pour un client qui ouvre Kreatly une fois par semaine, la cloche « c'est l'équivalent de rien ». `sendEmail` n'est appelé que deux fois dans toute l'app, dans `review/actions.ts` (envoi au client, décision du client).
2. **Inviter, c'est copier un lien et l'envoyer soi-même.** `InviteDialog` (`brands/[id]/team-section.tsx:408`) génère le lien et dit « Copie-le et envoie-le ». Aucun e-mail d'invitation n'existe ; `create_brand_invitation` (0008/0043) ne connaît pas d'adresse.
3. **Le client s'inscrit, puis doit encore cliquer « Accepter ».** `register` redirige vers `/invite/{token}` (ou, en prod, via `/auth/callback?next=/invite/…` après confirmation de l'e-mail) ; la page réaffiche l'invitation avec le bouton « Accepter l'invitation » (`app/invite/[token]/accept-form.tsx`). Il vient de créer un compte **pour** cette invitation : lui redemander, c'est un clic de trop.
4. **« Qui prévient qui » est éparpillé.** `audience()`, `senderName()`, `contentCard()` vivent dans `review/actions.ts` ; la cloche vit dans deux triggers ; rien ne dit, à un seul endroit, qui est prévenu de quoi et par quel canal.

---

## 2. Le métier : prévenir celui qui ne regarde pas

L'équipe vit dans l'app : la cloche lui suffit. **Le client, lui, ne vient que quand on l'appelle** : chaque fois qu'on attend quelque chose de lui, ou qu'on lui a répondu, un e-mail part. Et quand on l'invite, c'est l'app qui l'invite, pas un lien collé dans WhatsApp.

Règle de sobriété (quota Resend partagé entre projets, 3 000 par mois) : un e-mail par événement, jamais pour un échange interne à l'équipe, jamais à soi-même, jamais bloquant pour l'action.

| Événement | Cloche | E-mail | À qui |
|---|---|---|---|
| Envoi au client | — | oui (existe) | les clients invités (`viewer`) de la marque |
| Décision du client | oui (0057) | oui (existe) | l'équipe (sauf `viewer`) |
| **L'équipe répond à une remarque du client** | oui (0057) | **nouveau** | l'auteur de la remarque, s'il est `viewer` |
| Réponse de l'équipe à l'équipe | oui (0057) | non | — |
| **Invitation avec une adresse** | — | **nouveau** | l'adresse saisie, une fois, non stockée |
| Contenu validé, à programmer | oui (0046) | non | — |

---

## 3. Ce qu'on construit

### 3.1 Un seul module — `lib/notify.ts`

Tout ce qui décide **qui** reçoit **quoi** s'y trouve : `audience()`, `senderName()`, `contentCard()` y déménagent depuis `review/actions.ts` (qui les importe), et deux fonctions s'y ajoutent. `lib/email.ts` reste le transport (gabarit, Resend). Les actions appellent ; elles ne décident pas.

- `notifyClientOfReply(supabase, { parentId, replyId, body })` : lit le commentaire parent (`user_id`, `content_id`), cherche son auteur dans `list_brand_members_with_emails` ; **s'il est `viewer` et que ce n'est pas moi**, envoie « L'équipe t'a répondu » — la réponse en citation, le contenu en carte, bouton « Voir la réponse » vers `/review?c={contentId}`, `replyTo` = celui qui répond, expéditeur « {Marque} via Kreatly ». Sinon rien. Appelée par `replyToComment` **après** l'insertion, jamais bloquante (même règle que les deux e-mails existants).
- `notifyInvitation(supabase, { brandId, email, token, role, note })` : « {Inviteur} t'invite à rejoindre {Marque} sur Kreatly », le rôle en clair (« Client » pour `viewer`), la note si elle existe, bouton « Ouvrir l'invitation » vers `/invite/{token}`, `replyTo` = l'inviteur. Appelée par `createBrandInvitation` quand une adresse est donnée.

### 3.2 L'invitation part de l'app — `InviteDialog` + `createBrandInvitation`

- Un champ **« E-mail de la personne (optionnel) »** sous la note, `type="email"`. Vide : le lien se génère comme aujourd'hui. Rempli : le lien se génère **et** part à cette adresse. L'adresse n'est pas stockée (0043 ne la connaît pas, on ne l'ajoute pas) : une invitation est un lien, l'e-mail n'est que sa remise.
- `createBrandInvitation(brandId, role, note, email?)` valide l'adresse (forme simple), crée le lien, envoie, et renvoie `{ token, sentTo?: string }`.
- L'écran « lien prêt » dit, quand un e-mail est parti : **« Invitation envoyée à x@… — le lien reste copiable ci-dessous. »** Sinon le texte actuel. Le lien reste visible et copiable dans les deux cas.
- Rien d'autre ne change dans la boîte : trois champs (rôle, note, e-mail), deux boutons.

### 3.3 Le compte créé pour une invitation la rejoint tout seul

- `register` (compte avec session, en dev) et `/auth/callback` (après confirmation de l'e-mail, en prod) : quand `next` est une page d'invitation, ils y ajoutent `?welcome=1`.
- `/invite/[token]` avec `welcome=1`, personne connectée, invitation valide : la page **accepte** (`accept_brand_invitation` ; déjà membre → on passe outre) puis redirige par la porte du chantier 2, `/switch-brand?to={brand}&next=/dashboard`. Un éditeur arrive sur le tableau de bord ; un client y est renvoyé vers son calendrier par la règle existante.
- Sans `welcome=1` (quelqu'un qui a déjà un compte et ouvre le lien), rien ne change : il voit la marque et le rôle, et clique « Accepter ». Accepter reste un acte conscient quand on n'a pas créé son compte pour ça.

### 3.4 Documentation

- `docs/10-notifications.md` : le tableau de la section 2, et où vit chaque chose (`lib/notify.ts`, `lib/email.ts`, triggers 0013/0046/0057).
- `CLAUDE.md` : décision 24 ; la ligne « Notifications : in-app uniquement (pas d'email pour l'instant) » du module 11 est périmée, corrigée.
- ADR `docs/decisions/2026-10-13-qui-previent-qui.md`.
- Libellés fr/en/ar : le champ e-mail, son aide, « Invitation envoyée à … ».

---

## 4. Ordre de livraison

1. `lib/notify.ts` (déménagement + deux fonctions) et `replyToComment`.
2. Invitation : action + boîte + libellés.
3. `welcome=1` : `register`, `/auth/callback`, `/invite/[token]`.
4. Docs, version v101, un seul passage des gardiens sur le diff, une seule vérification du déploiement.

Effort : **petit** — aucune table, aucune migration, aucun nouvel écran. Deux e-mails de plus, un champ, un paramètre.

---

## 5. Ce qu'on ne fait pas

- **Pas d'e-mail pour les échanges internes** (équipe ↔ équipe) ni pour « validé, pense à le programmer » : la cloche suffit à qui vit dans l'app, et le quota est partagé.
- **Pas de stockage de l'adresse invitée** : l'invitation reste un lien ; stocker l'adresse obligerait à la gérer (modifier, effacer, afficher).
- **Pas de rappel « ton client n'a pas répondu »** : exigerait une tâche de fond, interdite.
- **Pas de préférences de notification** : un écran de réglages de plus pour une cible qui veut moins d'étapes.

---

## 6. Verdicts

_Après le code : `logique-produit` une fois sur le diff (20 lignes), `ui-design` une fois sur la boîte d'invitation (20 lignes), modèle léger._

**`logique-produit` (sur le diff, modèle léger) — ⚠️ Cohérent avec réserves**, intégrées : `welcome=1` n'accepte sans clic que pour un compte créé il y a moins d'une heure (le paramètre est copiable) ; un client qui répond à un autre client ne déclenche pas d'e-mail ; la ligne « Email notifications » de `CLAUDE.md` mise à jour.

**`ui-design` (sur la boîte d'invitation, modèle léger) — ⚠️ Acceptable avec réserves**, intégrées : libellé « E-mail (optionnel) » et aide plus courte ; « Envoyer l'invitation » seulement quand l'adresse est complète ; échec d'envoi dit en clair (« L'e-mail n'a pas pu partir vers x@… — copie le lien… ») ; réussite visible dans le bloc du lien avec une coche ; « Envoi en cours… » + spinner, champs et « Annuler » figés pendant l'envoi.
