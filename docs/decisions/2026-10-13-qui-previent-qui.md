# 2026-10-13 — Qui prévient qui : un module, et l'e-mail pour celui qui ne regarde pas

**Statut :** accepté.

## Contexte

Deux e-mails existaient (envoi au client, décision du client), écrits dans l'action de validation avec leurs règles d'audience. Le reste passait par la cloche, y compris la réponse de l'équipe à une remarque du client — que le client, qui ouvre Kreatly une fois par semaine, ne voyait pas. L'invitation était un lien à copier et envoyer soi-même. Et un compte créé pour une invitation devait encore cliquer « Accepter ».

## Options envisagées

1. Un e-mail pour tout, y compris les échanges internes. Le quota Resend est partagé entre projets, et l'équipe vit dans l'app.
2. Stocker l'adresse invitée pour la réutiliser. Une colonne de plus à gérer (modifier, effacer, afficher) pour une donnée qui ne sert qu'une fois.
3. **Un module « qui prévient qui »** (`lib/notify.ts`), deux e-mails de plus ciblés sur le client, l'invitation remise par e-mail sans stockage, et l'acceptation automatique pour un compte créé pour l'invitation.

## Décision

Option 3. La règle : l'équipe a la cloche ; le client reçoit un e-mail chaque fois qu'on attend quelque chose de lui ou qu'on lui a répondu. Un e-mail par événement, jamais interne, jamais à soi-même, jamais bloquant. Les actions appellent le module ; elles ne décident pas.

## Conséquences

- Un seul endroit dit qui est prévenu de quoi (`docs/10-notifications.md`).
- L'adresse d'invitation n'existe que le temps de l'envoi.
- `welcome=1` est le seul cas où une page accepte une invitation sans clic : il n'est posé que par l'inscription et la confirmation d'e-mail.
