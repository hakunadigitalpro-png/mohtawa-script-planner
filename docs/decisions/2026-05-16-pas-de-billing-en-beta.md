# ADR — Pas de billing en bêta (option D)

- **Date** : 2026-05-16
- **Statut** : ✅ Accepted

## Contexte

Le founder se pose la question du modèle économique :
- Trial 14 jours puis paywall ?
- Plan freemium ?
- 100 % gratuit pour la bêta puis monétisation après ?

Le projet n'a pas encore d'utilisateur réel. Coder du Stripe + des limites + des gates prend 1-2 semaines de dev pour potentiellement 0 client.

## Question secondaire

Le founder se demande si laisser des utilisateurs trial expirés en read-only coûte cher en hébergement → tentation de supprimer leurs données à expiration.

### Analyse coûts

Pour 1 utilisateur trial expiré :
- DB rows : ~0,001 €/mois (texte négligeable)
- Storage images (5-20 MB) : ~0,0002 €/mois (0,021 $/GB sur Supabase)
- Bandwidth (s'il revient consulter) : ~0,01 €/mois
- **Total : ~0,01 €/mois par user expiré**

→ Pour 1000 users expirés : ~10 €/mois. Au pire 25 €/mois (Supabase Pro plan déclenché).

**Conversion industrielle SaaS** :
- Données préservées : 8-12 % de conversion (un user qui revient et retrouve ses scripts upgrade pour les débloquer)
- Données supprimées : 2-4 % (friction de redémarrer = abandon)

→ Supprimer économise ~10 €/mois mais divise le revenu par 3.

## Options envisagées

### A. Trial 14 jours → paywall avec suppression à J15
- ➖ Tue la conversion (cf chiffres ci-dessus)
- ➖ Bad UX (perte de données ressentie comme injuste)
- ➖ Risque de bouche-à-oreille négatif

### B. Trial 14 jours → read-only à J15, archive à J90, delete à J365
- ➕ Bon compromis coût/conversion (~10 €/mois pour 1000 expirés)
- ➖ Nécessite déjà du code de gates + status transitions

### C. Limites strictes mais accès gratuit illimité (freemium)
- ➕ Tout le monde teste, certains upgradent pour débloquer
- ➕ Pas de "trial qui expire" à coder
- ➖ Nécessite de coder les limites

### D. **100 % gratuit pour la bêta**, ajouter billing après 10-20 actives users
- ➕ Pas de code billing à écrire maintenant
- ➕ Les premiers utilisateurs deviennent des fans loyaux ("c'était gratuit")
- ➕ On apprend ce qu'ils valorisent avant de paywaller
- ➕ Permet d'itérer le produit librement
- ➖ 0 revenu garanti pendant la bêta
- ➖ Faut migrer vers payant un jour, ce qui peut frustrer les early users

## Décision

**Option D : Bêta 100 % gratuite. Billing à ajouter quand on a 10-20 utilisateurs actifs.**

Raisonnement :
- Pour un solo founder, **time-to-market > revenu immédiat**
- 1-2 semaines à coder Stripe = 1-2 semaines à NE PAS coder de feature qui valide le produit
- On ne sait pas encore ce que les gens valoriseront → impossible de fixer un prix juste
- L'architecture est **prête à recevoir** le billing (cf plus bas), on peut switcher rapidement

## Pré-requis architecturaux (déjà en place)

Pour pouvoir ajouter Stripe en 1-2 jours quand le moment viendra :

- ✅ Schéma DB pensé pour accueillir une table `subscriptions` (déjà documentée dans `03-billing-logic.md`)
- ✅ Server actions structurées : un seul endroit par mutation où ajouter un check `canDoX()`
- ✅ Sécurité RLS-first : un gate sera enforcé côté DB, pas seulement côté app
- ✅ Pas d'accumulation de logique gate-able partout (centralisable dans `lib/billing.ts`)

## Ce qu'on NE FAIT PAS pour l'instant

- ❌ Pas de table `subscriptions`
- ❌ Pas de helpers `canCreateBrand`, `canGenerateAi`, etc.
- ❌ Pas de bandeau "Trial : 14 jours"
- ❌ Pas de page `/pricing`
- ❌ Pas d'intégration Stripe

## Quand activer le billing ?

Critères de bascule :
1. **10-20 utilisateurs actifs** (utilisent l'app au moins 1× par semaine)
2. Le founder a parlé à au moins **5 d'entre eux** pour savoir ce qu'ils paieraient
3. Au moins **2 utilisateurs** ont exprimé spontanément "je serais prêt à payer pour ça"

À ce moment, on enchaîne :
1. Migration `subscriptions` + `ai_usage`
2. Helpers `canDoX()` + gates dans les server actions sensibles
3. Page `/pricing` + Stripe Checkout
4. Page Customer Portal
5. Bandeau "Trial expiré" / "Upgrade" dans la sidebar
6. Email de bienvenue + email expiration

## Conséquences

### Positives
- Focus 100 % sur le produit pendant la bêta
- Le founder peut itérer librement sans casser de paying users
- Architecture clean (pas de code "gate factice" à écrire)

### Négatives
- 0 € de revenu pendant la bêta
- Risque qu'on procrastine le moment du paywall ("encore un peu de bêta gratuite...")
- Conversion gratuit → payant typiquement 5-10 % → il faudra prévenir clairement le passage payant

## Suivi

À chaque milestone product (toutes les ~2 semaines), checker :
- Combien de utilisateurs uniques cette semaine ?
- Combien sont actifs (≥ 3 visites) ?
- Conversion bêta → payant arrive quand ?

## Liens

- [03-billing-logic.md](../03-billing-logic.md) — Future state Stripe complet
- [04-user-roles.md](../04-user-roles.md) — Plans → limites de membres
