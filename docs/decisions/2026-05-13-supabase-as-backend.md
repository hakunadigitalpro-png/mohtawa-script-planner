# ADR — Supabase comme backend

- **Date** : 2026-05-13
- **Statut** : ✅ Accepted
- **Décideur(s)** : hakuna (founder)

## Contexte

Au démarrage de Kreatly, on a besoin :
- D'une auth (email/mdp + reset)
- D'une base de données relationnelle (multi-marques, contenus, performances)
- D'un stockage de fichiers (images de storyboard)
- D'un système de sécurité par row (chaque utilisateur ne voit que ses données)
- D'un setup rapide pour un founder solo, sans DevOps lourde

Budget : 0 € pour la bêta, ≤ 50 €/mois jusqu'à 500 users actifs.

## Options envisagées

### A. Backend custom (Node/Express + Postgres self-hosted)
- ➕ Contrôle total
- ➖ DevOps lourde : héberger Postgres, gérer les backups, scaling, auth maison
- ➖ ~3 semaines de setup avant de coder la 1ère feature
- ➖ Coût d'hébergement non trivial

### B. Firebase
- ➕ Tout-en-un, auth + Firestore + Storage
- ➖ NoSQL (Firestore) : pas de SQL, pas de relations, pas de JOIN
- ➖ Vendor lock-in fort
- ➖ Pricing peu prévisible (par lecture/écriture)

### C. Supabase
- ➕ Postgres standard, transférable
- ➕ Auth + Storage + Realtime + Edge Functions inclus
- ➕ RLS Postgres pour la sécurité (puissant)
- ➕ Free tier généreux (500 MB DB, 50K MAU, 1 GB storage)
- ➕ Dashboard UI clair
- ➖ Encore jeune, mais maturité OK
- ➖ Quotas free tier limités (à monitorer)

### D. PlanetScale + Auth0 + S3
- ➕ Best-of-breed
- ➖ 3 services à intégrer, 3 factures, 3 dashboards
- ➖ Coût > Supabase dès le départ

## Décision

**Supabase**. Le combo Postgres + Auth + Storage + RLS dans un seul service correspond exactement au besoin. Le free tier permet de lancer sans dépenser un centime.

## Conséquences

### Positives
- Setup en quelques heures (vs 3 semaines pour B/D)
- Sécurité robuste via RLS (Postgres standard, audit facile)
- Pas de vendor lock-in fort : si on quitte un jour, on garde un Postgres standard exportable
- Realtime gratuit si on veut ajouter du collaboratif plus tard

### Négatives
- On dépend des quotas Supabase (à monitorer ; upgrade Pro à $25/mois si on dépasse)
- Édition d'images / transformations à la volée non incluse (à coupler avec Cloudinary plus tard si besoin)
- L'écosystème Supabase évolue vite → on doit suivre les release notes

## Liens

- [01-architecture.md](../01-architecture.md)
- [05-data-model.md](../05-data-model.md)
- Lien marketing Supabase : <https://supabase.com>
