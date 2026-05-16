# ADR — Abandon de Prisma au profit de supabase-js pur

- **Date** : 2026-05-14
- **Statut** : ✅ Accepted

## Contexte

Le scaffold initial du projet avait été fait avec Prisma comme ORM, en plus de `@supabase/supabase-js` pour l'auth. Cette double couche posait des questions de cohérence et d'utilité réelle dès le démarrage de l'écriture du code applicatif.

## Options envisagées

### A. Garder Prisma + supabase-js
- ➕ Types DB générés automatiquement par Prisma
- ➕ ORM expressif (`prisma.content.findMany({ where: ... })`)
- ➕ Migrations managées par Prisma Migrate
- ➖ **Double couche** : Prisma pour les requêtes, supabase-js pour l'auth/storage → cognitive overhead
- ➖ Prisma bypass RLS si on utilise une `DATABASE_URL` directe (service role) → on perd la sécurité naturelle de Postgres
- ➖ Migrations Prisma vs SQL Supabase : risque de divergence
- ➖ Bundle plus gros (Prisma client = quelques MB)

### B. Prisma seul (sans supabase-js)
- ➖ Pas d'auth Supabase native (faut tout réimplémenter)
- ➖ Pas de Storage (faut S3 ou autre)
- → Élimine en cohérence avec [ADR Supabase backend](./2026-05-13-supabase-as-backend.md)

### C. supabase-js seul (drop Prisma)
- ➕ Une seule couche, un seul mental model
- ➕ RLS appliquée automatiquement (Postgres voit le JWT de l'user)
- ➕ Migrations SQL pures, comprises par n'importe quel DBA
- ➕ Bundle réduit
- ➖ Pas d'ORM (mais l'API Supabase est assez expressive pour notre besoin)
- ➖ Types DB à générer via `supabase gen types` ou à écrire à la main (`lib/types.ts`)

## Décision

**supabase-js seul. Drop Prisma**.

Pour un SaaS solo sur stack Supabase, Prisma ajoute plus de friction qu'il ne sauve de temps :
- L'API `supabase.from('contents').select('*, reel_details(*)').eq('id', id)` est aussi expressive que Prisma pour notre besoin
- RLS = sécurité automatique sans code applicatif
- 1 seule façon de faire des requêtes → onboarding plus rapide

## Implémentation

Commit du nettoyage :
- Supprimé `prisma/schema.prisma`
- Supprimé `prisma.config.ts`
- Retiré `@prisma/client` de `package.json`
- Types DB désormais maintenus à la main dans `lib/types.ts` (suffit pour notre volume)

## Conséquences

### Positives
- Code Supabase consistent partout
- Migrations SQL "vanilla" (copy-paste dans le SQL editor)
- RLS appliquée sans réfléchir
- Pas de codegen à lancer à chaque schema change

### Négatives
- Types DB doivent être maintenus manuellement (peut diverger du schéma réel → à surveiller)
- Pas de protection compile-time si on change un nom de colonne sans mettre à jour `lib/types.ts`
- À gros volume (> 100k vidéos par user), l'absence d'ORM rendrait certaines requêtes complexes plus verbeuses

## Mitigations

- Possibilité plus tard de générer les types via `supabase gen types typescript --project-id ylhsnlxefxeuxtblcmwd > lib/database.types.ts` quand le schéma stabilise
- Si on a vraiment besoin de transactions complexes : utiliser des fonctions SQL (RPC) plutôt que de réintroduire Prisma

## Liens

- [01-architecture.md](../01-architecture.md)
- [ADR Supabase backend](./2026-05-13-supabase-as-backend.md)
