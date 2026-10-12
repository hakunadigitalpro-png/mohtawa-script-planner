# 2026-10-12 — La marque suit le contenu qu'on regarde

**Statut :** accepté.

## Contexte

La marque active vit dans un cookie. Tout l'écran en dépend : le menu latéral, le rôle (et donc ce qu'on a le droit de faire), l'interrupteur d'écriture assistée, Krea, la navigation « précédent / suivant ». Or les liens traversent les marques : l'e-mail « Modification demandée », la notification de la cloche, la tâche « Programmer X ». Avant ce chantier, un lien ouvrait la fiche sous la marque du cookie — rôle faux, menu faux, sans rien pour le signaler. Seule la cloche basculait avant d'ouvrir (0056). Et un lien ouvert sans être connecté perdait sa cible : le middleware renvoyait vers `/login` sans `next`, alors que le formulaire savait le lire.

Dans le même mouvement, « Envoyer au client » partait sans vérifier qu'un client existait ni qu'il y avait quelque chose à montrer ; et les tâches d'une personne restaient éparpillées par marque.

## Options envisagées

1. **Une bannière « Tu es sur Adala — basculer »** sur la fiche. Un clic de plus à chaque lien, et le rôle resterait faux tant qu'on n'a pas cliqué.
2. **Dériver tout de `content.brand_id`** dans la page, sans toucher au cookie. Le menu latéral et Krea, rendus par le layout, resteraient sur l'autre marque : deux marques à l'écran.
3. **Basculer automatiquement par une porte unique** : un route handler `GET /switch-brand` pose le cookie après avoir vérifié l'appartenance, puis redirige vers le contenu. Un Server Component ne peut pas écrire un cookie pendant son rendu ; un handler, si.

## Décision

Option 3, avec trois règles :

- **Le contenu d'abord, la marque ensuite, le rôle en dernier.** La fiche charge le contenu (la RLS répond ou non), bascule si la marque diffère, et ne renvoie un `viewer` vers sa page de validation qu'une fois sous la bonne marque — le rôle est par marque, pas par cookie.
- **Une seule porte** pour suivre un lien : la fiche, `/review?c=` et la cloche passent par `/switch-brand`. Le choix explicite d'une marque dans le sélecteur reste une action.
- **Le lien survit à la connexion** : `/login?next=` dans les deux sens, filtré par `safeNext`.

Et dans le même chantier :

- **« Envoyer au client » a ses conditions, par tous les chemins** : un client invité, et quelque chose à montrer — exactement ce que l'écran de validation affiche (`fetchReviewMaterial`, partagé entre l'écran et le garde `whyNotSendable`). Le menu Statut y obéit comme le bouton. Les stories deviennent validables : l'écran montre leurs diapos.
- **Les tâches** : la cloche crée la tâche sur la marque de la notification, à moi ; `/tasks?all=1` liste ce qui m'est assigné partout. Le tableau reste celui de l'équipe.

## Conséquences

- Un lien mène toujours au bon endroit sous la bonne marque, connecté ou non.
- Un cookie posé par un `GET` n'ouvre aucun droit : la RLS décide, le cookie ne fait que choisir ce qu'on affiche.
- L'écran de validation et le garde ne peuvent plus diverger : ils lisent la même chose.
- Reste à resserrer, hors périmètre : `tasks_insert` (0049) laisse un `viewer` insérer une tâche par l'API.
