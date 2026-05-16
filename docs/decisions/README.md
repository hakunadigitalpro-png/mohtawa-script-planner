# Architecture Decision Records

Décisions structurantes du projet. Chaque ADR est immutable une fois acceptée : si on change d'avis, on crée un nouveau ADR qui supersede l'ancien.

## Format

Chaque fichier suit ce template :

```markdown
# ADR XXX — Titre

- **Date** : YYYY-MM-DD
- **Statut** : Proposed / Accepted / Superseded / Deprecated
- **Décideur(s)** : nom

## Contexte
Le problème à résoudre + contraintes.

## Options envisagées
Liste des alternatives avec pour chacune les pros/cons.

## Décision
Quelle option on retient, et pourquoi.

## Conséquences
Bonnes et mauvaises. Ce que ça implique pour la suite.

## Liens
ADRs liés, issues, commits importants.
```

## Index

| Date | ADR | Statut |
|---|---|---|
| 2026-05-13 | [Choix Supabase comme backend](./2026-05-13-supabase-as-backend.md) | ✅ Accepted |
| 2026-05-13 | [App Router (pas Pages Router)](./2026-05-13-app-router-over-pages.md) | ✅ Accepted |
| 2026-05-14 | [Abandon de Prisma](./2026-05-14-abandon-prisma.md) | ✅ Accepted |
| 2026-05-14 | [Sécurité RLS-first](./2026-05-14-rls-first-security.md) | ✅ Accepted |
| 2026-05-15 | [Drag & drop natif HTML5 (pas de lib)](./2026-05-15-drag-drop-html5-natif.md) | ✅ Accepted |
| 2026-05-15 | [PDF Export via Print CSS](./2026-05-15-pdf-export-via-print-css.md) | ✅ Accepted |
| 2026-05-16 | [Pas de billing en bêta (option D)](./2026-05-16-pas-de-billing-en-beta.md) | ✅ Accepted |
| 2026-05-16 | [Taxonomies par marque (vide par défaut)](./2026-05-16-taxonomies-par-marque.md) | ✅ Accepted |
| 2026-05-16 | [i18n en pause après refonte UI](./2026-05-16-i18n-en-pause.md) | ✅ Accepted |
