# Spec 07 — Sharing et pages publiques

## Vue d'ensemble

Deux types de pages exposées hors auth :
1. `/share/[token]` : vue publique d'une vidéo via un lien partageable (style Notion)
2. `/print/[id]` : page imprimable pour Export PDF (en réalité protégée par auth via middleware, mais sort du layout `(app)`)

## Sharing via token

### Activation côté utilisateur

Sur la fiche `/content/[id]` :
1. Bouton "Partager" → ouvre `<ShareDialog>`
2. Toggle "Lien public actif"
3. Quand toggle ON → Server Action `enableSharing(id)` appelle RPC `enable_content_sharing(uuid)`
4. Le RPC génère un token base64url de ~24 caractères via `gen_random_bytes(18)` + nettoyage des `+/=`
5. Token stocké dans `contents.share_token`
6. Modal affiche le lien complet : `https://{origin}/share/{token}`
7. Bouton "Copier" (clipboard) + bouton "Générer un nouveau lien" (révoque l'ancien)

### Désactivation

Toggle OFF → `disableSharing(id)` → `UPDATE contents SET share_token = NULL`. Toute requête future sur l'ancien token retourne 404.

### Rotation

"Générer un nouveau lien" appelle à nouveau `enable_content_sharing(id)` → écrase le token précédent. Effet : l'ancien lien expire immédiatement.

## Page `/share/[token]`

### Accès public

- Pas d'authentification requise (route whitelistée dans le middleware)
- Pas de cookies à présenter
- Le user anonyme appelle la RPC `get_shared_content(token)` qui est `SECURITY DEFINER` et accessible aux rôles `anon` et `authenticated`

### Récupération des données

```ts
const { data } = await supabase.rpc("get_shared_content", { p_token: token });
```

Le RPC :
1. Cherche `contents.id WHERE share_token = $1`
2. Si non trouvé → renvoie `null` → la page affiche 404
3. Sinon, construit un JSONB avec :
   - `content` (sans `share_token` — exclu du payload pour éviter qu'un visiteur ne re-share)
   - `brand_name` (nom de la marque)
   - `reel`, `story`, `slides`, `scenes`, `performance` selon ce qui existe
4. Renvoie le bundle au client

### Rendu

- Header sobre : logo Kreatly + badge "Lecture seule"
- Title block : brand name (eyebrow), titre, chips (type, statut, plateforme, date)
- Sections affichées :
  - Plan : pilier, objectif, hook, CTA, tags
  - Script (si Reel) : intro / point1-3 / transition / recap / outro / script complet
  - Storyboard (si Reel) : grille de scènes avec images
  - Storyboard Planner (si Story) : 5 cartes phone-frame
  - Performances : si renseignées
- Footer CTA discret : "Créer ta propre fiche avec Kreatly" → `/login`

### SEO

```ts
export const metadata = {
  robots: { index: false, follow: false },
};
```

Pages **exclues de l'indexation Google** pour éviter de fuiter du contenu privé via les SERPs.

## Page `/print/[id]`

### Accès

Protégée par middleware (auth requise). Mais **hors du route group `(app)`** → ne hérite pas du sidebar.

### Rendu

Page server-rendered avec un CSS dédié `print.css` :
- Layout 800px max, padding généreux, blanc pur
- En haut : actions bar avec bouton "Retour" et "Imprimer" (cachés à l'impression via `@media print`)
- Sections : Plan → Script ou Stories → Storyboard → Performances
- Storyboard en grille 2 colonnes (16:9 per scene)
- Stories en row de 5 cartes phone (9:16)
- `page-break-inside: avoid` sur chaque scène/story pour éviter les coupes en milieu de carte

### Workflow utilisateur

1. Sur `/content/[id]` → clic "Exporter PDF" → ouvre `/print/[id]` dans un nouvel onglet
2. Sur `/print/[id]` → clic "Imprimer / Enregistrer en PDF"
3. Boîte de dialogue native du navigateur → choisir "Enregistrer en PDF" comme destination
4. Le navigateur génère le PDF respectant le CSS print

## Sécurité

### Pourquoi `SECURITY DEFINER` et pas une simple policy RLS pour `/share` ?

Si on faisait :
```sql
create policy "contents_select_shared" on contents
  for select to anon, authenticated
  using (share_token is not null);
```

L'anon pourrait **lister tous les contenus partagés** en faisant `SELECT * FROM contents WHERE share_token IS NOT NULL`. PostgREST retournerait toutes les rows.

Avec `SECURITY DEFINER`, on contrôle exactement ce qui est exposé : une seule row à la fois, identifiée par son token. Pas de browse.

### Pourquoi exclure `share_token` du payload ?

Si on l'incluait, un visiteur du share pourrait copier le token et l'utiliser. Il l'a déjà dans l'URL, mais l'exclusion du payload est une double sécurité (par exemple, si une copy-paste involontaire d'une réponse JSON expose les tokens).

### Que se passe-t-il si on supprime une vidéo partagée ?

CASCADE delete supprime toutes les rows liées. La RPC `get_shared_content` ne trouve plus rien → 404 sur la page publique. Bon comportement.

### Risque : énumération du token ?

Token = 24 caractères base64url. Espace ≈ 2^144 combinaisons → impossible à brute-forcer. Pas de risque pratique.

## Évolutions possibles

- **Liens avec expiration** : ajouter `share_expires_at`, vérifié dans la RPC
- **Liens avec mot de passe** : `share_password_hash`, demandé sur la page
- **Statistiques de partage** : table `share_views(token, viewed_at, ip)` pour savoir si un client a consulté
- **Partage avec commentaires** : table `share_comments` permettant à un client de laisser des notes sur la fiche
- **Multiple shares per content** : actuellement un seul `share_token` par vidéo. Si on veut générer 2 liens (interne / client), il faut une table `share_links(content_id, token, label)`
