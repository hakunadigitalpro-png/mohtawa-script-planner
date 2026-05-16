# ADR — Taxonomies par marque (piliers et objectifs), vides par défaut

- **Date** : 2026-05-16
- **Statut** : ✅ Accepted

## Contexte

Initialement, le champ `pillar` (pilier de contenu) sur une vidéo était une saisie libre en texte, et `objective` était une liste fermée hardcodée de 5 valeurs (Éducation, Personal Brand, Vente, Notoriété, Engagement).

Limite identifiée : **chaque client/marque a ses propres piliers** (définis selon le projet, la période, le positionnement). Un consultant peut travailler avec :
- Nutriclinic → Piliers : Nutrition, Sport, Mentalité
- Sculpture Clinic → Piliers : Hydrafacial, Microneedling, Skincare
- Son compte perso → Piliers : Marketing, Productivité, Personal branding

Un dropdown global ne marche pas. Il faut **par marque**.

Question secondaire : faut-il pré-remplir les nouvelles marques avec des objectifs par défaut ?

## Options envisagées

### Pour la structure

#### A. Garder text libre
- ➕ 0 dev, fonctionne déjà
- ➖ Pas de cohérence (typos : "Marketing digital" vs "marketing digital" → analytics cassé)
- ➖ Pas de menu, friction à chaque saisie

#### B. Liste globale partagée par tous les users
- ➖ Faux problème : chacun a ses piliers, mélanger n'a aucun sens
- → Élimination immédiate

#### C. Tables par marque (`brand_pillars`, `brand_objectives`)
- ➕ Chaque marque a sa liste curée
- ➕ Dropdown propre + bouton "+" pour ajouter
- ➕ Renommage cascade sur les vidéos existantes
- ➖ Migration DB
- ➖ Légère duplication (la même chaîne saisie 2× chez 2 marques différentes)

### Pour les défauts

#### A. Pré-remplir avec 5 objectifs par défaut
- ➕ L'utilisateur a tout de suite quelque chose à sélectionner
- ➖ Présuppose les objectifs business du user (peut être complètement à côté)
- ➖ Pollution si non utilisés

#### B. Liste vide par défaut, user remplit
- ➕ Chaque marque démarre avec une page blanche
- ➕ Force l'utilisateur à réfléchir aux objectifs spécifiques de sa marque
- ➖ Friction initiale (rien dans le dropdown)

## Décision

**C pour la structure, B pour les défauts.**

- Deux tables `brand_pillars` et `brand_objectives` par marque
- **Aucun pré-remplissage** : liste vide à la création de marque
- L'utilisateur ajoute ses propres piliers/objectifs depuis `/brands/[id]` ou inline depuis l'éditeur (`+` à côté du dropdown)

### Évolution intermédiaire abandonnée

La migration 0006 initialement avait un **seed automatique** des 5 objectifs par défaut (`brands_seed_objectives` trigger). Le founder a vu le résultat et explicitement demandé une page blanche → migration 0007 a supprimé le trigger + nettoyé les rows.

## Détail technique

### Conservation des données historiques

Question : si on renomme/supprime un pilier, qu'arrive-t-il aux vidéos existantes ?

**Choix** : `contents.pillar` et `contents.objective` restent du **texte libre** (pas une FK uuid vers `brand_pillars`). Pourquoi :
- Rename cascade explicitement géré côté server action (`UPDATE contents SET pillar = newName WHERE brand_id = X AND pillar = oldName`)
- Delete laisse les vidéos tranquilles : elles gardent la valeur en texte (juste plus dans le dropdown)
- Pas de risque de "vidéo orpheline si on supprime un pilier"

### Inline create

Composant `<SelectWithCreate>` : dropdown rond + bouton "+" qui ouvre une modal pour ajouter une valeur. Le nouveau pilier est immédiatement disponible dans tous les autres dropdowns.

### Backfill (migration 0006 puis 0007)

À l'origine on a backfillé les marques existantes avec les 5 défauts. Migration 0007 a tout vidé suite à la décision finale. Si un user avait ajouté manuellement un objectif portant exactement un des 5 noms par défaut, il a été supprimé aussi (accepté car la feature avait < 1h en prod).

## Conséquences

### Positives
- Chaque marque a sa terminologie propre → l'analytics par pilier devient enfin pertinent
- Pas d'objectifs génériques qui n'ont rien à voir avec la marque
- Cascade rename propre

### Négatives
- Petite friction à l'inscription : "Choisir un pilier" est vide au début → user doit en créer un avant de sélectionner
- Si un user gère 5 marques, il doit configurer les piliers de chacune (mais c'est ce qu'il veut)

## Évolutions possibles

- **Templates de piliers** : "Quelle thématique gères-tu ?" à la création de marque → suggérer 3-5 piliers selon le secteur (santé, marketing, fitness, etc.). À considérer si on observe la friction "vide" en bêta.
- **Couleurs par pilier** : la colonne `brand_pillars.color` existe déjà mais pas exposée dans l'UI. Quand on l'expose, les badges/charts pourraient utiliser ces couleurs custom.
- **Réordonner par drag** : actuellement `position` est utilisé mais pas modifiable par l'user.

## Liens

- [04-user-roles.md](../04-user-roles.md)
- [06-content-lifecycle.md](../06-content-lifecycle.md)
- Migrations 0006 + 0007
