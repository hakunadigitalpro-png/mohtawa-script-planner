# ADR — Next.js App Router (pas Pages Router)

- **Date** : 2026-05-13
- **Statut** : ✅ Accepted

## Contexte

Next.js 16 propose deux modèles de routing :
- **Pages Router** : modèle historique (`pages/`)
- **App Router** : modèle plus récent (`app/`) basé sur React Server Components

Lequel choisir pour Kreatly ?

## Options envisagées

### Pages Router
- ➕ Mature, documentation pléthorique
- ➕ Modèle mental simple (getServerSideProps, API routes...)
- ➖ Bundle client plus gros (tout est CC par défaut)
- ➖ Pas de Server Actions natifs
- ➖ Considéré legacy par l'équipe Next.js (pas d'évolutions majeures planifiées)

### App Router
- ➕ Server Components par défaut → moins de JS envoyé au client
- ➕ Server Actions natifs → pas besoin de coder des API routes pour chaque mutation
- ➕ Layouts imbriqués + route groups → meilleure organisation
- ➕ Streaming + Suspense first-class
- ➕ La direction officielle de Next.js
- ➖ API encore en évolution (mais stabilité atteinte fin 2024)
- ➖ Documentation plus dispersée
- ➖ Patterns moins établis (chacun trouve sa façon de faire)

## Décision

**App Router**.

Le modèle Server Components colle parfaitement à Kreatly :
- La plupart des pages sont des lectures DB (Dashboard, Calendrier, Analytics, fiche détail) → Server Components fetchent directement, pas d'API à coder
- Server Actions remplacent les API routes pour les mutations
- Route groups (`(auth)`, `(app)`) permettent de séparer layouts proprement

Le moindre overhead initial (modèle nouveau à apprendre) est compensé par les gains en perfs et la simplification du code.

## Conséquences

### Positives
- Bundle client minimal (~30-40 % plus léger que Pages équivalent)
- Pas de fichiers `pages/api/*.ts` à maintenir
- Layouts imbriqués naturels (sidebar dans `(app)`, centré dans `(auth)`)
- Streaming UI possible sans effort

### Négatives
- Quelques librairies ne supportent pas encore parfaitement Server Components (ex: certains datepickers) → fallback en `"use client"` quand nécessaire
- Les Server Actions ne peuvent pas passer des fonctions en props vers les Client Components (sérialisation) → on apprend à structurer correctement (cf bug rencontré sur le BarChart)
- Pas de gestionnaire de cache fin-grained à la React Query → on s'appuie sur `revalidatePath` qui est plus brut

## Liens

- [01-architecture.md](../01-architecture.md) — Routing section
- Next.js App Router docs : <https://nextjs.org/docs/app>
