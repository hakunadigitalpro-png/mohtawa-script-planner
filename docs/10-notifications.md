# Spec 10 — Qui prévient qui

_Chantier 3, 2026-10-13._

## La règle

L'équipe vit dans l'app : la cloche lui suffit. **Le client, lui, ne vient que quand on l'appelle** : chaque fois qu'on attend quelque chose de lui, ou qu'on lui a répondu, un e-mail part. Un e-mail par événement, jamais pour un échange interne, jamais à soi-même, jamais bloquant pour l'action (un serveur de mail qui répond mal n'annule rien).

Quota Resend : 3 000 par mois, partagé entre projets (voir la mémoire `reference_resend_email`).

## Le tableau

| Événement | Cloche | E-mail | À qui | Où |
|---|---|---|---|---|
| Envoi au client | — | oui | les clients invités (`viewer`) | `submitForReview` → `audience("clients")` |
| Décision du client | oui (0057) | oui | l'équipe (sauf `viewer`) | `reviewContent` → `audience("equipe")` |
| L'équipe répond à une remarque du client | oui (0057) | oui | l'auteur de la remarque, s'il est `viewer` | `replyToComment` → `notifyClientOfReply` |
| Réponse de l'équipe à l'équipe | oui (0057) | non | — | — |
| Invitation avec une adresse | — | oui, une fois | l'adresse saisie, non stockée | `createBrandInvitation` → `notifyInvitation` |
| Contenu validé, à programmer | oui (0046) | non | — | trigger `notify_brand_on_approved` |

## Où vit chaque chose

- **Qui reçoit quoi** : `lib/notify.ts` — `audience`, `contentCard`, `senderName` (« {Marque} via Kreatly »), `notifyClientOfReply`, `notifyInvitation`. Les actions appellent, elles ne décident pas.
- **Le transport** : `lib/email.ts` — gabarit unique (`renderEmail`), envoi par destinataire (`sendEmail`), désactivé sans `RESEND_API_KEY`.
- **La cloche** : triggers `notify_brand_on_comment` (0013, réécrit 0057), `notify_brand_on_approved` (0046) ; lecture par `list_my_notifications` (0056, avec la marque).

## L'invitation

Une invitation reste un lien (`create_brand_invitation`, 0008/0043). L'adresse saisie dans « Créer un lien » ne sert qu'à le remettre : elle n'est pas stockée. Le compte créé pour une invitation la rejoint tout seul : `register` et `/auth/callback` posent `welcome=1` sur le chemin d'invitation (`withWelcome`, `lib/utils.ts`), et `/invite/[token]` accepte puis bascule par `/switch-brand`. Quelqu'un qui a déjà un compte voit la marque et le rôle, et clique « Accepter ».

## Ce qu'on ne fait pas

Pas d'e-mail pour les échanges internes ni pour « validé, pense à le programmer » ; pas de rappel « ton client n'a pas répondu » (tâche de fond interdite) ; pas d'écran de préférences.
