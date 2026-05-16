# Spec 04 — User roles & permissions

## Vue d'ensemble

Permissions au niveau **marque**, pas au niveau global. Un utilisateur peut être :
- Membre de N marques avec des rôles différents sur chacune
- Owner d'une marque qu'il a créée
- Sans accès à une marque dont il n'est pas membre

Pas de "super admin" plateforme pour l'instant.

## Schéma

```sql
brand_members (
  brand_id  uuid,
  user_id   uuid,
  role      brand_role,     -- enum
  created_at timestamptz,
  primary key (brand_id, user_id)
)

create type brand_role as enum ('owner', 'admin', 'editor', 'viewer');
```

## Les 4 rôles

| Rôle | Lire | Créer/Éditer contenu | Supprimer contenu | Inviter membres | Renommer marque | Supprimer marque |
|---|---|---|---|---|---|---|
| **viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **editor** | ✅ | ✅ | ✅ (les siens) | ❌ | ❌ | ❌ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Note** : l'implémentation actuelle vérifie principalement `is_brand_member` (lecture/CRUD basique). La granularité role-based n'est pas encore enforced partout — voir la section Évolutions.

## Attribution des rôles

### Owner

Attribué automatiquement à l'utilisateur qui crée la marque, via le trigger SQL `brands_add_owner` (AFTER INSERT sur `brands`).

```sql
insert into public.brand_members(brand_id, user_id, role)
values (new.id, new.created_by, 'owner');
```

### Autres rôles (admin/editor/viewer)

**Pas encore implémenté** — pas de flow d'invitation. Pour ajouter manuellement (via SQL editor) :

```sql
insert into brand_members(brand_id, user_id, role)
values ('<brand-uuid>', '<user-uuid>', 'editor');
```

### Évolution prévue : flow d'invitation

1. Owner/admin tape un email dans `/brands/[id]` → server action `inviteToBrand(brandId, email, role)`
2. Si l'email existe dans `auth.users` → ajout direct dans `brand_members`
3. Si l'email n'existe pas → envoi d'un mail "tu es invité par X à rejoindre la marque Y" + lien vers `/register?invite=<token>`
4. Token stocké dans une table `brand_invitations` (à créer)

## Application des permissions

### Côté DB (RLS)

Toutes les policies RLS utilisent le helper :

```sql
public.is_brand_member(brand_id) returns boolean
```

Qui matche `brand_members.user_id = auth.uid()` ET `brand_members.brand_id = $1`.

**Aujourd'hui le rôle n'est pas vérifié dans les policies** — tout membre peut tout faire sur la marque (sauf delete brand qui vérifie owner explicitement). À durcir si on ajoute viewer/editor concrètement.

### Côté app (UI)

Sur `/brands` :
- Bouton "Renommer" affiché si `role in ('owner', 'admin')`
- Bouton "Supprimer" affiché si `role === 'owner'`

Les contrôles UI sont indicatifs ; **la sécurité vient des policies RLS**.

## Cas particuliers

### Dernier owner d'une marque

Aujourd'hui, rien n'empêche un owner de se retirer lui-même (ce qui rendrait la marque orpheline). À durcir :

```sql
-- Future : empêcher la suppression du dernier owner
create or replace function public.prevent_last_owner_removal() ...
```

### Suppression d'un user (cascade)

`auth.users` → `brand_members.user_id ON DELETE CASCADE` → les memberships disparaissent.
`brands.created_by → auth.users ON DELETE CASCADE` → la marque est supprimée si le créateur disparaît.

⚠️ **À reconsidérer** : peut-être qu'on veut garder la marque même si le créateur supprime son compte (si d'autres membres existent). À traiter dans une future migration.

### Marque sans owner

Théoriquement impossible (le trigger garantit qu'il y a toujours un owner à la création). Mais après cascade delete d'un user, on peut arriver à `0 owner`. Le SQL ne contraint pas ce cas pour l'instant.

## Évolutions prévues

| Feature | Priorité | Note |
|---|---|---|
| Flow invitation par email | Moyenne | nécessaire dès qu'on a des équipes |
| Enforcement role-based dans RLS | Moyenne | quand le multi-user devient courant |
| Empêcher le retrait du dernier owner | Haute | risque de marque orpheline |
| Transfer of ownership | Basse | utile pour les agences |
| Audit log (qui a fait quoi) | Basse | pour la conformité |

## Lien avec billing

Le plan détermine le **nombre max de membres** par marque :
- Trial : 1 (tu seul)
- Pro : 3
- Agency : 10

Logique à ajouter dans `inviteToBrand` quand le billing est wire :

```ts
const gate = await canAddMember(currentUser.id, brandId);
if (!gate.ok) return { error: "Limite de membres atteinte. Upgrade en Agency." };
```
