# ADR — Sécurité RLS-first

- **Date** : 2026-05-14
- **Statut** : ✅ Accepted

## Contexte

Mohtawa est multi-tenant (chaque utilisateur a ses propres marques et contenus). Comment garantir qu'un utilisateur ne peut JAMAIS voir/modifier les données d'un autre, même via une erreur de code ?

## Options envisagées

### A. Checks applicatifs (vérifier dans chaque server action)
- ➖ Erreur humaine probable : oublier un check = leak
- ➖ Verbose : chaque mutation doit vérifier ownership
- ➖ Pas de defense-in-depth (la DB fait confiance au code)

### B. RLS-first (Row Level Security Postgres)
- ➕ Sécurité DÉCLARÉE au niveau DB → impossible à bypasser
- ➕ Defense-in-depth : même un bug app ne peut pas faire fuiter de données
- ➕ Une seule source de vérité (les policies SQL)
- ➕ Audit facile : SELECT * FROM pg_policies
- ➖ Apprentissage RLS Postgres (mais courbe rapide)
- ➖ Risque de récursion sur les policies si on n'utilise pas SECURITY DEFINER pour les helpers

### C. Hybride (RLS + checks app)
- ➕ Defense-in-depth maximale
- ➖ Code doublé : chaque check côté app + côté DB
- ➖ Risque d'incohérence entre les 2 layers

## Décision

**RLS-first**. Pas de checks d'autorisation côté application.

Pattern adopté :
- Chaque table → RLS activée
- Helper `is_brand_member(brand_id uuid) returns boolean` en `SECURITY DEFINER` (évite la récursion)
- Policies utilisent cet helper : `using (public.is_brand_member(brand_id))`
- Pour les opérations spéciales (création de brand, lecture publique d'un share), on utilise des **RPC SECURITY DEFINER** qui font leur propre validation (`if auth.uid() is null then raise exception`)

## Conséquences

### Positives
- **Impossible** de leak des données entre utilisateurs depuis le code app
- Sécurité auditable : `SELECT * FROM pg_policies` montre toutes les règles
- Code app simplifié : pas de `if (content.user_id !== currentUser.id) throw ...`
- Conformité GDPR plus facile (isolation au niveau DB)

### Négatives
- **Apprentissage** : il faut comprendre comment RLS fonctionne et éviter les pièges (récursion, `auth.uid()` qui renvoie null dans certains contextes)
- **Debugging** : si on a un "permission denied", il faut savoir lire les policies. Outils Supabase aident (logs dans le dashboard).
- **Performance** : chaque requête évalue les policies. À haut volume, peut nécessiter des indexes spécifiques (mais pas un problème à notre échelle)

## Pièges rencontrés (et résolus)

### Récursion sur les policies
Première écriture des policies sur `brand_members` :
```sql
using (
  exists (
    select 1 from brand_members m
    where m.brand_id = brand_members.brand_id
      and m.user_id = auth.uid()
  )
)
```
→ Récursion infinie ! La policy de SELECT sur `brand_members` faisait une sous-requête sur `brand_members`, qui re-déclenchait la policy...

**Solution** : helper `is_brand_member(uuid)` en `SECURITY DEFINER` (bypass RLS dans la fonction).

### auth.uid() peut être null à l'insert
Premier essai sur `brands_insert_self` :
```sql
with check (created_by = auth.uid())
```
→ Échouait dans certains cas où l'app passait `created_by` directement.

**Solution** : trigger BEFORE INSERT qui force `new.created_by := auth.uid()` si null. Plus de risque de mismatch.

### Migration 0003 — bascule via RPC
Encore mieux : on a créé une RPC `create_brand(name text)` en `SECURITY DEFINER` qui :
1. Lit `auth.uid()` explicitement
2. INSERT INTO brands sans passer par les policies (bypass via DEFINER)
3. Renvoie le brand_id

→ L'app appelle `supabase.rpc('create_brand', { p_name: name })` et tout se passe correctement.

## Liens

- [01-architecture.md](../01-architecture.md) — Sécurité
- [02-auth-flow.md](../02-auth-flow.md)
- [05-data-model.md](../05-data-model.md)
- Supabase RLS docs : <https://supabase.com/docs/guides/auth/row-level-security>
