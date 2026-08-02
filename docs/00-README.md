# Documentation Kreatly Script Planner

Specs fonctionnelles + décisions techniques (ADR) du produit.

## 📚 Specs fonctionnelles

| # | Doc | Contenu |
|---|---|---|
| 01 | [Architecture](./01-architecture.md) | Stack, routing, data flow, sécurité |
| 02 | [Auth flow](./02-auth-flow.md) | Inscription, connexion, reset, sessions, middleware |
| 03 | [Billing logic](./03-billing-logic.md) | État actuel (bêta gratuite) + future state (plans + Stripe) |
| 04 | [User roles](./04-user-roles.md) | Rôles dans `brand_members` et permissions |
| 05 | [Data model](./05-data-model.md) | Schéma DB complet avec contraintes et RLS |
| 06 | [Content lifecycle](./06-content-lifecycle.md) | Cycle de vie d'une vidéo (idée → mesure) |
| 07 | [Sharing & public pages](./07-sharing-public-pages.md) | Tokens de partage, page publique, export PDF |
| 08 | [AI Generator](./08-ai-generator.md) | Prompts, modèle, limites, coûts |
| 09 | [Theme system](./09-theme-system.md) | Light/Dark/Custom, persistance, customisation |

## 🧠 Architecture Decision Records

Voir [decisions/README.md](./decisions/README.md) pour l'index complet.

Format ADR : chaque décision structurante est un fichier daté décrivant le **contexte**, les **options envisagées**, la **décision retenue**, et les **conséquences**.

---

## 🔄 Comment maintenir cette doc

- **Spec fonctionnelle** : à mettre à jour quand un module change de comportement ou gagne une feature
- **ADR** : créer un nouveau fichier daté pour chaque décision structurante (jamais éditer un ancien ADR — ajouter un nouveau qui marque l'ancien comme `Superseded`)

Convention de naming ADR : `YYYY-MM-DD-titre-court.md`

---

## 📖 Lecture suggérée

**Pour découvrir le projet** (ordre de lecture) :
1. [CLAUDE.md](../CLAUDE.md) à la racine du repo (vue d'ensemble condensée)
2. [01-architecture.md](./01-architecture.md)
3. [05-data-model.md](./05-data-model.md)
4. [06-content-lifecycle.md](./06-content-lifecycle.md)
5. ADRs récents dans `decisions/`

**Pour ajouter une feature** :
1. Vérifier qu'aucun ADR ne contredit l'approche
2. Si la feature touche un module documenté → lire/mettre à jour la spec
3. Si la décision est structurante → créer un nouvel ADR
