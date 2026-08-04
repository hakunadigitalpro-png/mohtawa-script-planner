# Audit qualité, sécurité & performance — Kreatly (Script Planner)

**Date :** 2026-08-04
**Périmètre :** toute l'application (`app/`, `components/`, `lib/`, `middleware.ts`, `next.config.ts`, `supabase/migrations/*.sql`, `messages/*.json`) — **pas seulement les derniers changements**.
**Méthode :** exploration de l'architecture, vérification manuelle des points sensibles (secrets, frontière client/serveur, RLS de base, RPC d'équipe), puis 4 audits approfondis (RLS multi-tenant, Server Actions, performance, qualité/i18n/tests). Les constats les plus graves ont été re-vérifiés dans le code source.
**Statut :** lecture seule — **aucun fichier n'a été modifié**. Les correctifs sont à appliquer ensuite, point par point.

> Légende gravité : 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 mineur / bon point
> `IBM` = `public.is_brand_member(brand_id)` (helper RLS central).

---

## 📌 État d'avancement — mis à jour le 2026-08-04 (prod `p2c`)

**Phase 0 (sécurité critique) — ✅ TERMINÉE & déployée**
- ✅ #1 Bucket privé `insights` (migr. 0032) · #2 Token Meta cloisonné (0033) · #3 Auth + rate-limit IA (`lib/ai-guard.ts`, 0034) · #4 Reset-password via `NEXT_PUBLIC_SITE_URL`

**Phase 1 (quick wins) — ✅ TERMINÉE & déployée**
- ✅ #5 OpenAI→Claude partout (FAQ, pricing, `ai.errors`) · #8 `server-only` sur `lib/ai.ts` · #9 code mort OpenAI/DALL-E supprimé · #6 anti mass-assignment (helper `pick()`) · #7 `revalidatePath` ciblé (taxonomie)

**Phase 2 — partielle**
- ✅ #10 Tests : vitest + `lib/utils.test.ts` (10 tests — `pick` / `safeNext` / `extractJsonBlock`). Lancer avec `npm test`.
- ✅ #14 Édition d'un commentaire = auteur seul + RPC `set_comment_resolved` (migr. 0036)
- ⬜ **#11** Alléger la fiche `content/[id]` : colonnes `performances` ciblées, `transcript`/`autopsy_md` chargés seulement si `status === 'published'`
- ⬜ **#12** Borner le dashboard : `.select()` colonnes explicites + `.limit()` + pagination + KPIs via `count()`
- ⬜ **#13** Localiser les erreurs IA (renvoyer `e.code` → `t('ai.errors.<code>')`) + purger les clés `ai.errors.*` mortes

**Phase 3 — partielle**
- ✅ #16 Index `brand_members(user_id)` (migr. 0035) + `safeNext` factorisé dans `lib/utils.ts` — **reste : factoriser `safeT`**
- ✅ #18 Partage public : seuls les commentaires invités renvoyés + anti-spam `add_guest_comment` (migr. 0036)
- 🟡 **#15** i18n : `Select` « Aucune option » fait (FR/EN/AR) — **reste ~40 chaînes FR en dur** (titres de `Dialog`, `aria-label`, placeholders « Ex : … », `components/field-help/script-help.tsx` entièrement FR)
- ⬜ **#17** Retirer `unoptimized` sur `/share` et `/print` (ou compresser à l'upload dans `ImageUpload`)
- ⬜ **#19** MAJ `CLAUDE.md` + `docs/` (disent encore « OpenAI gpt-4o-mini » / « i18n non câblé ») + ~10 classes physiques RTL résiduelles (`auth-shell.tsx`, `notifications-bell.tsx`…)

> **✅ Migrations Supabase `0032`→`0036` toutes appliquées (confirmé le 2026-08-04) + `NEXT_PUBLIC_SITE_URL` défini côté Vercel.**
>
> **▶️ Reprise** — quand l'utilisatrice dit « **on continue les optimisations et performance** », reprendre les ⬜/🟡 ci-dessus. Ordre conseillé : **#12** dashboard → **#11** fiche vidéo → **#13** erreurs IA → **#15** i18n (reste) → **#17** images → **#19** docs.

---

## Verdict global

**Risque global : 🟠 MOYEN — acceptable pour la bêta fermée actuelle (cercle Mariam/Maryem), à durcir AVANT toute ouverture multi-clients publique.**

L'architecture « RLS-first » est **saine** : isolation multi-tenant solide au niveau des lignes, aucun secret côté client, aucune fuite cross-tenant critique. Les vrais points durs sont :

1. **La lecture des secrets et des fichiers** échappe au modèle « ligne » : bucket Storage **public** et **token Meta** lisible par tout membre.
2. **Le coût IA n'est pas maîtrisé** : plusieurs Server Actions déclenchent des appels Claude/Groq (payants) sans authentification stricte ni limitation de débit.
3. **Défense en profondeur faible** : ~51 Server Actions sans check d'auth explicite, mass-assignment possible, entrées peu validées — tout repose sur la RLS. Si une seule policy régresse, plus aucun filet.
4. **Zéro test automatisé** sur une base qui fait entièrement confiance à la RLS.

### Résumé chiffré

| Domaine | 🔴 | 🟠 | 🟡 | Point fort |
|---|---|---|---|---|
| Sécurité (secrets, injection, IA) | 0 | 4 | 4 | Pas de `service_role`, clés serveur-only, pas de XSS |
| Isolation multi-tenant (RLS) | 0 | 2 | 4 | 20/20 tables en RLS, 0 policy ouverte |
| Performance | 1 | 5 | 6 | Tout en `next/image`, index de base présents |
| Qualité / maintenabilité | 0 | 4 | 1 | Typage exemplaire (0 `any`) |
| i18n / RTL | 0 | 3 | 3 | Parité 3 langues parfaite (672 clés), bon RTL |
| Tests | 1 | 0 | 0 | — |

---

## 1. 🔒 Sécurité

### ✅ Points forts (vérifiés dans le code)
- **Aucune clé `SUPABASE_SERVICE_ROLE_KEY`** dans tout le dépôt → aucun client ne contourne la RLS. Les opérations privilégiées passent par des fonctions `SECURITY DEFINER` qui re-vérifient l'appelant.
- Les clés IA (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`) sont **uniquement en `process.env` dans `lib/ai.ts`** (serveur) — jamais en `NEXT_PUBLIC_`.
- Seules variables publiques : `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publiques par nature, sûres. `.env*` est bien dans `.gitignore`.
- **Aucun** `dangerouslySetInnerHTML` / `eval` / `innerHTML` → pas de vecteur XSS évident.
- Middleware d'auth (`lib/supabase/middleware.ts`) : redirection propre, `getUser()` (valide le JWT côté serveur, pas `getSession`), routes publiques explicites.
- Bons exemples à généraliser : `safeNext()` anti open-redirect (`app/(auth)/login/actions.ts:7`), `createComment` qui prend `user_id` de la **session** et valide le body (`app/(app)/contents/comment-actions.ts:11`), `updateTheme`/`setLocale` qui valident HEX/locale (`app/(app)/actions.ts:53,93`).

### Failles

**🟠 Coût / DoS financier IA — appels Claude déclenchables sans garde-fou ni rate-limiting**
`app/(app)/contents/ai-actions.ts:21,170,297,398` · `app/(app)/brands/taxonomy-actions.ts:174`
`aiGenerateReel`, `aiGenerateStory`, `aiGenerateVlog`, `analyzeReferenceVideoAction` et `themeAssistant` appellent Claude/Groq (payants) avec des paramètres venus du client, **sans `getUser()`, sans vérif d'appartenance, sans limite de débit**. `themeAssistant` appelle même `themeAssistantTurn` sans garde `if (!brand) return`. Un utilisateur connecté (ou toute personne pouvant POSTer l'action) peut boucler ces appels → **facture IA qui explose**.
**Correctif :** helper `requireUser()` en tête ; garde `if (!brand) return` ; validation de longueur des entrées (`topic`, `transcript`) ; **rate-limiting** par utilisateur (compteur en base ou Upstash) sur toutes les actions qui touchent l'IA.

**🟠 Mass-assignment — l'objet `patch` du client est injecté tel quel dans `.update()`/`.upsert()`** *(vérifié)*
`app/(app)/contents/actions.ts:91` (`updateContent` → `.update(patchWithFlag)`), et même schéma sur `upsertReelDetails:293`, `upsertVlogDetails:338`, `upsertStoryDetails:364`, `upsertStorySlide:382`, `upsertPerformance:413`, `updateScene:454`, `updatePublication:684`, `upsertBrandKit` (`taxonomy-actions.ts:280`).
La RLS filtre **quelles lignes** sont modifiables, pas **quelles colonnes**. Les types TypeScript sont effacés à l'exécution : un client forgé peut ajouter au `patch` des clés hors-formulaire (`brand_id`, `user_id`, `share_token`, `auto_status`…). J'ai confirmé sur `updateContent` que ces colonnes atteindraient le `.update()` — un membre pourrait ainsi déplacer un contenu vers une autre marque dont il est membre, ou se forger un `share_token` public choisi.
**Correctif :** whitelister explicitement les colonnes autorisées avant l'update (construire un objet à partir d'une liste fixe de clés), exactement comme le fait déjà `updatePillar` (`taxonomy-actions.ts:110-140`) — bon contre-exemple à généraliser.

**🟠 SSRF potentiel — `videoUrl` du client fetchée côté serveur sans validation**
`app/(app)/contents/ai-actions.ts:398` → `transcribeWithGroq(input.videoUrl)` (`lib/ai.ts:569`)
`analyzeReferenceVideoAction` passe une URL fournie par le client à un téléchargement serveur (pour l'envoyer à Groq), **sans vérifier que c'est bien une URL du Storage Supabase**. Un attaquant pourrait viser une URL interne (métadonnées cloud, service interne).
**Correctif :** valider que `videoUrl` commence bien par `https://<host-supabase>/storage/v1/object/public/` avant tout fetch. *(Feature « analyse de référence » actuellement parkée, mais l'action reste appelable.)*

**🟡 `lib/ai.ts` sans `import "server-only"`**
`lib/ai.ts:1`
Rien n'empêche techniquement d'importer ce module (qui lit les clés API) depuis un Client Component. Les secrets non-`NEXT_PUBLIC_` ne fuiteraient pas (Next les retire du bundle client), mais les prompts/logique partiraient au client et les appels casseraient silencieusement.
**Correctif :** ajouter `import "server-only";` en tête de `lib/ai.ts`.

**🟡 Reset-password — `redirectTo` dérivé d'en-têtes spoofables** *(vérifié)*
`app/(auth)/reset-password/actions.ts:11`
`origin = h.get("origin") ?? h.get("x-forwarded-host")` puis `redirectTo: ${origin}/login`. Ces en-têtes sont falsifiables → **empoisonnement du lien de réinitialisation** (le mail de reset d'une victime peut pointer vers un domaine attaquant). Atténué uniquement par l'allow-list de Redirect URLs côté Supabase. Bug annexe : `x-forwarded-host` est un host sans schéma → URL invalide en fallback.
**Correctif :** utiliser une base URL de confiance (`NEXT_PUBLIC_SITE_URL`), jamais un en-tête de requête ; vérifier que l'allow-list Supabase est stricte.

**🟡 Absence de `getUser()` quasi généralisée (défense en profondeur)**
~51 Server Actions sur 58 n'appellent aucun `getUser()` (liste complète dans l'annexe des Server Actions ci-dessous). La RLS protège les données, donc pas d'exploitation frontale aujourd'hui — mais **zéro filet en cas de régression d'une policy**.
**Correctif :** helper `requireUser()` mutualisé, appelé en tête de chaque action mutante.

**🟡 Validation d'entrées manquante (types / plages / allowlists)**
Ex. `createContent` — `type`/`brandId` non validés (`contents/actions.ts:19,32`) ; `status` string libre non validée (`:128`) ; `slotNumber` non borné 1..10 (`:382`) ; métriques de perf non validées (`:413`) ; `category`/`label` checklist (`:485`) ; `platform` publication (`:642`) ; `targetType`/`targetId` commentaire (`comment-actions.ts:11`) ; `language` profil (`actions.ts:38`) ; `token` invitation (`team-actions.ts:57`).
**Correctif :** valider chaque paramètre contre une liste/plage fixe avant usage.

**🟡 Rôle d'équipe non plafonné au niveau de l'appelant** *(vérifié)*
`supabase/migrations/0008_team_invitations.sql:215` (`update_member_role`) + `0001_initial.sql:220` (policy INSERT `brand_members`)
Bonne nouvelle : les RPC **vérifient bien** que l'appelant est owner/admin et **imposent « ≥ 1 owner »**. Mais `p_role` n'est **pas borné au rôle de l'appelant** → un **admin peut se promouvoir owner** (`update_member_role(brand, self, 'owner')`) ou insérer directement un membre en `owner`. Escalade intra-tenant limitée, acceptable en bêta.
**Correctif :** interdire d'octroyer un rôle supérieur à celui de l'appelant ; réserver la gestion des owners aux owners.

---

## 2. 🏢 Isolation multi-tenant (RLS)

### ✅ Verdict : 🟢 socle solide
Les **20 tables applicatives ont `enable row level security`**, **aucune** policy `using (true)` / `with check (true)`, toutes les tables enfants remontent jusqu'à la marque via `contents.brand_id`, et **toutes** les fonctions `SECURITY DEFINER` re-vérifient l'appelant (`auth.uid()`, appartenance, ou capability-token à forte entropie) et fixent `set search_path = public`. Le cloisonnement en **écriture** (y compris Storage upload/delete) est correct. **Aucune fuite cross-tenant critique 🔴 trouvée.**

### Failles (hors modèle « ligne »)

**🟠 Token Meta/Instagram lisible par n'importe quel membre, y compris `viewer`**
`supabase/migrations/0025_meta_connections.sql:31` (colonne `access_token`) + `:46` (policy SELECT)
La policy SELECT porte sur toute la ligne (`using (IBM)`). Le token OAuth longue durée (~60 j, permet de **lire ET publier** sur l'Instagram du client) est renvoyé par un simple `select * from meta_connections` à **tout membre**, même invité `viewer`. C'est le seul vrai secret en base, et il est mal cloisonné.
**Correctif :** exposer une **vue** `meta_connections_public` (statut, `@username`, `token_expires_at`) et révoquer le SELECT direct sur la table ; ne lire le token que via une fonction `SECURITY DEFINER` restreinte owner/admin.

**🟠 Bucket Storage `content-media` PUBLIC — aucune isolation en lecture**
`supabase/migrations/0004_video_only.sql:82` (`public = true`)
Toutes les images (captures d'insights d'autopsie **contenant tes chiffres : vues/audience/revenus**, logos de marque, storyboards) sont téléchargeables par **n'importe qui, non authentifié**, avec l'URL. Seule protection : l'imprévisibilité de l'UUID du chemin → **sécurité par obscurité** (les URLs fuient via referer, logs, historique, liens partagés). Aucune policy SELECT ne filtre par marque.
**Correctif :** passer le bucket en privé (`public=false`) + servir via **URLs signées** générées côté serveur après vérif d'appartenance, et ajouter une policy `for select` sur `storage.objects` calquée sur les policies insert.

**🟡 `content_comments` UPDATE trop permissif — tout membre peut réécrire n'importe quel commentaire**
`supabase/migrations/0009_comments.sql:89`
Le `USING` (`user_id = auth.uid() OR IBM`) ne distingue pas les colonnes : n'importe quel membre peut modifier le `body`/`resolved`/`target_id` de **tout** commentaire de la marque, pas seulement le sien. Altération non tracée de la parole d'autrui (intra-tenant).
**Correctif :** restreindre le `USING` de l'UPDATE à `user_id = auth.uid()` ; gérer le toggle *resolved* par les autres via une RPC dédiée qui ne touche que cette colonne.

**🟡 `add_guest_comment` — RPC anonyme sans anti-abus + amplification de notifications**
`supabase/migrations/0012_share_with_comments.sql:73,158` + `0013_notifications.sql:74`
La RPC est exposée à `anon` : quiconque a un `share_token` en mode `comment` peut insérer des commentaires **sans rate-limit ni captcha**, et chaque insert crée **une notification par membre** → flood possible de la table et des cloches.
**Correctif :** rate-limiting par token/fenêtre + plafond de commentaires + anti-spam des notifications invité.

**🟡 `get_shared_content` divulgue les commentaires internes d'équipe sur le lien public**
`supabase/migrations/0012_share_with_comments.sql:274`
La RPC publique renvoie **tous** les `content_comments` de la vidéo (seuls les emails sont masqués) → toute discussion interne laissée sur un bloc devient visible par quiconque a le lien de partage.
**Correctif :** ne renvoyer dans le bundle public que les commentaires invités (`user_id is null`), ou un flag « visible côté partage ».

**🟡 `content_checklist_items` — policies sans `to authenticated`**
`supabase/migrations/0011_checklist_items.sql:26-63`
Contrairement à toutes les autres tables, les 4 policies s'appliquent au rôle PUBLIC (donc `anon`). Ça **échoue fermé** aujourd'hui (l'`anon` n'a pas l'EXECUTE sur `is_brand_member`), mais c'est une incohérence risquée si l'EXECUTE était un jour ré-accordé.
**Correctif :** ajouter `to authenticated` aux 4 policies.

**🟢 (mineur) Bug fonctionnel Storage :** pas de policy `UPDATE` pour les chemins `presets/{brand_id}` et `brand/{brand_id}` (`0029`, `0031`) → écraser un logo au même chemin échouera (bug, pas sécurité).

---

## 3. ⚡ Performance

### ✅ Points forts
Tout passe par **`next/image`** (aucun `<img>` natif), les index de base sont présents (`contents(brand_id)`, `(brand_id, date)`, `share_token`, GIN `pillars/objectives`, tables enfants indexées sur `content_id`).

### Failles

**🔴 N+1 — un `COUNT` par marque dans une boucle séquentielle**
`app/(app)/brands/page.tsx:30-45`
La liste des marques est chargée en 1 requête, puis pour **chaque** marque une requête `count` séquentielle. 8 marques = 9 allers-retours en série. *(Impact réel aujourd'hui limité car peu de marques par utilisateur, mais c'est le pattern le plus coûteux du code.)*
**Correctif :** une seule requête avec agrégat imbriqué (`brands(..., contents(count))`) ou, a minima, `Promise.all` sur les counts.

**🟠 Sur-récupération `performances.select("*")` → colonnes lourdes sérialisées jusqu'au client**
`app/(app)/content/[id]/page.tsx:92`
`performances` porte `transcript`, `autopsy_md`, `insights_image_urls[]`. Le résultat est passé en prop au Client Component `DetailTabs` → ces colonnes volumineuses partent dans le payload **même quand la vidéo n'est pas publiée** (l'onglet Perf n'existe que si `published`).
**Correctif :** sélectionner les colonnes légères par défaut ; ne charger `transcript/autopsy_md` (et la prop `perf`) que si `status === "published"`.

**🟠 Dashboard : `.select("*")` sans `.limit()`**
`app/(app)/dashboard/page.tsx:51-70`
La grille charge **toutes** les vidéos de la marque, toutes colonnes, sans pagination. Coût DB + payload croissent sans borne — or c'est la page la plus visitée.
**Correctif :** `.select("id, type, title, status, platform, date")` + `.limit(50)` + pagination (`range`).

**🟠 Frontière Server/Client — tout le dataset de la fiche traverse vers le client**
`app/(app)/content/[id]/page.tsx:259` + `components/content-detail/detail-tabs.tsx:25`
`DetailTabs` est `"use client"` juste pour l'état d'onglet, mais reçoit **l'intégralité** des données (content, reel, story, vlog, slides, scenes, perf, publications, presets, checklist…) → tout est sérialisé dans le payload Flight à chaque chargement.
**Correctif :** ne transmettre que le nécessaire au rendu initial ; différer le chargement des données lourdes à l'ouverture de l'onglet concerné.

**🟠 `unoptimized` sur *toutes* les `<Image>` — l'optimiseur Next est désactivé**
`components/ui/image-upload.tsx:128`, `components/share/share-view.tsx:338,408`, `app/print/[id]/page.tsx:142,200`, `components/content-detail/storyboard-tab.tsx:618`, `app/(app)/brands/[id]/scene-preset-manager.tsx:85`
Next sert alors le fichier d'origine tel quel (pas de WebP, pas de resize). Or l'upload autorise **5 Mo/image** → sur `/share` (premier contact public) et `/print`, on peut télécharger plusieurs images pleine résolution. `next.config.ts` a pourtant `remotePatterns` correctement configuré.
**Correctif :** retirer `unoptimized` (au moins sur `/share` et `/print`) ; ou compresser/redimensionner à l'upload.

**🟠 `revalidatePath("/", "layout")` trop large sur des mutations ciblées**
`brands/taxonomy-actions.ts:44,88,161,256,283,327`, `team-actions.ts:69,108`, `comment-actions.ts:165`, `app/(app)/actions.ts:11,26,34,47,84,122,155`, `contents/actions.ts:760,775`
Invalide **tout** le cache Router sous le layout racine à chaque petite mutation (renommer un pilier vide le cache de dashboard/calendar/analytics/toutes les fiches).
**Correctif :** cibler les chemins réellement touchés (`revalidatePath("/brands/[id]")`, `("/dashboard")`) ; réserver `("/", "layout")` aux vrais changements globaux (marque active, thème).

**🟡 KPIs dashboard calculés en chargeant toutes les lignes** (`dashboard/page.tsx:32`) → utiliser `count()` `head:true`. Blocs séquentiels à grouper en `Promise.all`.
**🟡 `content/[id]` interroge `reel_details` + `story_details` + `vlog_details`** quel que soit le type (`page.tsx:79`) → 2 requêtes sur 3 renvoient `null`. Brancher sur `content.type`.
**🟡 `getUser()` + `resolveActiveBrand()` dupliqués** entre layout et pages (`layout.tsx:15,21` + chaque page) → mémoïser avec `React.cache()`.
**🟡 Index `brand_members(user_id)` manquant** (`0001:34`) : `brands/page.tsx:24` filtre sur `user_id` seul (2ᵉ colonne de la PK composite → pas de préfixe utilisable). Ajouter `create index brand_members_user_idx on brand_members(user_id)`.
**🟡 14 composants `components/landing/*` en `"use client"`** majoritairement statiques → JS inutile (impact faible, hors périmètre app).
**🟡 Filtres dashboard (`status`/`type`/`platform`/`ilike title`) sans index dédié** — acceptable tant qu'une marque n'a pas des milliers de contenus (priorité basse ; `pg_trgm` pour la recherche titre si besoin).

---

## 4. 🧹 Qualité & maintenabilité

### ✅ Points forts
**Typage exemplaire** : aucun `: any`, aucun `@ts-ignore`/`@ts-expect-error` dans tout le code applicatif. Gestion d'erreurs globalement propre, aucun `console.log` oublié. Les `catch {}` vides couvrent des cas légitimes (cookies SSR, clipboard, localStorage).

### Failles (séquelles de la migration OpenAI → Claude)

**🟠 Code mort OpenAI `generateJSON` (gpt-4o-mini)** — `lib/ai.ts:38-101` + constantes `OPENAI_URL:7`, `MODEL:9`. Zéro importateur. ~65 lignes mortes, et l'en-tête du fichier (« wrapper autour de l'API OpenAI ») ment sur ce que fait le module. → **supprimer.**

**🟠 Chaîne DALL-E présente mais non déclenchable** — `lib/ai.ts:155-277` (`generateSceneImage`, `buildScenePrompt`) + `ai-actions.ts:90` (`aiGenerateSceneImage`). L'action est importée/appelée par le compilateur mais **branchée à aucun bouton** (`grep` = 0 usage UI). ~190 lignes + un coût DALL-E inatteignable. → **décider : rebrancher un bouton, ou tout supprimer** (avec `OPENAI_IMAGE_URL:8`, `IMAGE_MODEL:10`).

**🟠 `safeNext` dupliqué à l'identique** — `login/actions.ts:7-12` == `register/actions.ts:7-12`. → extraire dans `lib/utils.ts`.

**🟠 Helper `safeT` copié-collé dans 6-7 fichiers** (`content-card.tsx`, `new-content-modal.tsx`, `dashboard-filters.tsx`, `hooks-library.tsx`, `plan-tab.tsx`, `analytics/page.tsx`, `content/[id]/page.tsx`). Double problème : duplication **et** anti-pattern i18n — envelopper chaque `t()` dans un try/catch avec repli français **masque les clés manquantes** (un trou EN/AR retombe silencieusement sur du français). → factoriser + s'appuyer sur `onError`/`getMessageFallback` global de next-intl.

**🟡 `actions.ts:118`** avale silencieusement l'échec d'enregistrement de la langue préférée (`auth.updateUser`) → au moins logguer.

**🟡 Doc obsolète** — `CLAUDE.md` affirme « i18n non câblé » et « AI : OpenAI gpt-4o-mini » : les deux sont **faux** (i18n entièrement actif, génération sur Claude). Idem `docs/03-billing-logic.md`, `docs/08-ai-generator.md`. → mettre à jour.

---

## 5. 🌍 i18n & RTL

### ✅ Points forts
**Parité des 3 langues PARFAITE** : `fr.json` / `en.json` / `ar.json` = **672 clés chacun**, diff vide dans les 6 sens. **RTL bien traité** : propriétés logiques (`ps-/pe-/ms-/me-/start-/end-`) massivement adoptées (~61 occ. / 34 fichiers), `dir="auto"` systématique sur les champs, utilitaire `rtl-flip` pour les chevrons.

### Failles

**🟠 ~41 chaînes françaises codées en dur dans le JSX** (placeholder / title / aria-label / texte visible) dans des composants qui utilisent pourtant `useTranslations` → ne basculeront jamais en EN/AR. Les plus visibles : `components/ui/select.tsx:102` (`Aucune option`, état vide de **tous** les Select), `create-brand-button.tsx:33` (`Nouvelle marque`), `publications-editor.tsx:246`, `pillar-manager.tsx:210,219` (aria-labels), nombreux placeholders « Ex : … » (`vlog-tab`, `theme-assistant`, `brand-kit-manager`, `video-autopsy:109`…). → router via `t(...)` + ajouter les clés.

**🟠 `components/field-help/script-help.tsx`** entièrement en français, **0 `useTranslations`** (~27 lignes) alors que son jumeau `pillar-help.tsx` est traduit. → passer par `fieldHelp.script`.

**🟠 Messages d'erreur IA en français figé + clés localisées orphelines** — les `AiError` (`lib/ai.ts`) et `setError("…")` (`theme-assistant.tsx:116`, `reference-analyzer.tsx:71`, `ai-actions.ts`) affichent du français en dur ; en parallèle `messages/*.json` définit `ai.errors.noApiKey/auth/api` dans les 3 langues **jamais référencées** (clés mortes). → renvoyer des **codes** (`e.code`) et mapper `t("ai.errors.<code>")` côté client (comme `login`/`register`).

**🟡 Inexactitude PUBLIQUE OpenAI → Claude** — `landing.faq.items.q3.answer` (fr/en/ar) affirme « On utilise **GPT-4o-mini d'OpenAI** » sur la **landing publique** : factuellement faux. Les messages `ai.errors.*` mentionnent aussi encore `OPENAI_API_KEY`. → réécrire (« Claude d'Anthropic ») + purger.

**🟡 ~10 classes physiques directionnelles résiduelles** (`auth-shell.tsx` 4× `left/right`, `notifications-bell.tsx`, `mobile-nav.tsx`, `multi-select-with-create.tsx`, `theme-assistant.tsx` 1× chacun) — surtout du positionnement décoratif. → convertir en `start-/end-`.

---

## 6. 🧪 Tests

**🔴 Couverture de tests strictement NULLE.**
Aucun fichier `*.test.*`/`*.spec.*` hors `node_modules`, aucun framework installé (ni vitest, ni jest, ni playwright), aucun script `test` (`package.json` = `dev`/`build`/`start`/`lint`). Sur une base qui fait **entièrement confiance à la RLS**, rien ne vérifie automatiquement que le cloisonnement tient.

**À tester en priorité (valeur/effort) :**
1. **Scoping RLS** (cœur sécurité) — tests d'intégration Supabase : un membre de la marque A ne lit/écrit pas les `contents` de B ; l'`anon` ne lit que via `get_shared_content(token)`.
2. **Parsing des réponses IA** (`lib/ai.ts` — `callClaudeJSON`, extraction JSON tolérante `themeAssistantTurn`) : casse silencieuse si le format dérive.
3. **`safeNext`** (anti open-redirect, 4 lignes) : `//evil.com`, `https://…`, `/dashboard`.
4. **Flux auth** (login/register, redirection `next`).

---

## 🗺️ Plan d'action priorisé

### Phase 0 — À traiter AVANT toute ouverture au-delà du cercle de confiance actuel
1. **Bucket Storage privé + URLs signées** (§2) — sinon captures d'insights (avec tes chiffres) et logos sont publiquement téléchargeables.
2. **Cloisonner le token Meta** (§2) — vue publique + lecture du token réservée owner/admin.
3. **Rate-limiting + `requireUser()` sur les actions IA** (§1) — protéger la facture Claude/Groq.
4. **Anti open-redirect du reset-password** (§1) + vérifier l'allow-list Supabase.

### Phase 1 — Rapide, fort ROI (quelques heures)
5. **Corriger la FAQ publique « GPT-4o-mini d'OpenAI » → « Claude d'Anthropic »** (§5) — faux, visible de tous.
6. **Whitelister les colonnes** dans `updateContent` & consorts (anti mass-assignment, §1).
7. **Restreindre `revalidatePath("/", "layout")`** aux chemins réellement touchés (§3).
8. **`import "server-only"` dans `lib/ai.ts`** (§1).
9. **Nettoyer le code mort OpenAI/DALL-E** (`generateJSON`, chaîne DALL-E) et l'en-tête trompeur de `lib/ai.ts` (§4).

### Phase 2 — Robustesse & perf (jour(s))
10. **Mettre en place vitest** + les 4 tests prioritaires (§6), en commençant par le scoping RLS et `safeNext`.
11. **Alléger la fiche `content/[id]`** : colonnes ciblées sur `performances`, chargement conditionnel des données lourdes, prop `perf` seulement si publié (§3).
12. **Borner le dashboard** (`.limit()` + colonnes explicites + KPIs en `count()`) (§3).
13. **Localiser les erreurs IA** (codes → `t(...)`) + purger les clés `ai.errors.*` mortes (§5).
14. **Restreindre l'UPDATE des commentaires** à l'auteur + RPC dédiée pour *resolved* (§2).

### Phase 3 — Finition & maintenabilité
15. Router les ~41 chaînes FR en dur + traduire `script-help.tsx` (§5).
16. Factoriser `safeNext` et `safeT` (§4) ; corriger l'index `brand_members(user_id)` (§3).
17. Retirer `unoptimized` (ou compresser à l'upload) sur `/share` et `/print` (§3).
18. Anti-abus `add_guest_comment` + ne pas exposer les commentaires internes sur le lien public (§2).
19. Mettre à jour `CLAUDE.md` et les docs (§4) ; nettoyer les classes physiques RTL résiduelles (§5).

---

*Audit réalisé en lecture seule — aucun code modifié. Les numéros de ligne référencent l'état du dépôt au 2026-08-04.*
