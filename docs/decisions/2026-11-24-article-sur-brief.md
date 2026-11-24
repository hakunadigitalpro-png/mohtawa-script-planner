# L'article s'écrit sur un brief, et ses règles se vérifient par du code

**Date** : 24/11/2026 — **Statut** : accepté

## Contexte

Premier article livré à un client (newsletter LinkedIn) : intertitres trop longs,
introduction et conclusion numérotées, idées répétées, texte de partage qui
recopiait l'article, critères que l'auteur ne respectait pas forcément. Mariam en
a tiré un cahier des charges. Il est appliqué tel quel.

## Décision

1. **Un brief avant d'écrire**, prérempli. `brand_kits.author_sheet` (fiche auteur)
   garde ce qui ne change pas d'un article à l'autre ; `brand_strategies.answers`
   complète. Compléter un vide enregistre, modifier un acquis seulement si on coche.
   La même fiche s'édite sur la page marque.
2. **Un seul appel IA** par article (900 mots au plus, 600 en arabe sans Gemini) :
   c'est ce qui garantit une idée une seule fois et une seule voix. Réponse
   **balisée**, pas en JSON, lue au fil de l'eau (`callClaudeDraft`) : une réponse
   coupée garde ses blocs fermés. Le brief est enregistré avant l'appel, la version
   reçue juste après.
3. **Rien ne s'applique sans lecture.** « Prendre cet article » remplace tout d'un
   coup (`write_article`, 0104) et garde les 8 dernières versions plus l'originale
   (`restore_article`). Ce qui manque à une réponse coupée laisse l'existant en place.
4. **Structure portée par `content_sections.role`** : `intro`, `item` (numéroté),
   `text`, `outro`. Le numéro est calculé ; il n'existe que si le titre l'annonce.
5. **Contrôles en code** (`lib/article-checks.ts`), sans IA : longueur, intertitres,
   numérotation, fins répétées, phrase recopiée, hashtags, emojis, promesses, voix,
   [À CONFIRMER]. Ils conseillent, ils ne bloquent pas.
6. **[À CONFIRMER] est une bonne réponse.** Il n'empêche pas d'envoyer au client —
   c'est lui qui confirme — mais il interdit « Programmé » par tous les chemins
   (`whyNotProgrammed`) : programmé, l'article part en ligne tout seul. « C'est en
   ligne » avertit sans refuser : c'est un constat. Ajouté APRÈS la programmation, le
   passage automatique en ligne l'ignore (`recompute_live_statuses`, 0103).
7. **À valider par l'auteur** (`article_claims`) : l'équipe coche, le client lit sur
   `/review` ce qui reste, et son « Je valide » suffit. Le brief, l'idée d'image et
   les versions de Krea (`article_briefs`) ne sont lisibles que par l'équipe.

## Conséquences

- Trois chemins partagent les mêmes règles de partage (`SHARE_TEXT_RULES`) :
  l'article complet, le bouton « Écrire le texte de partage », les contrôles.
- Krea (le chat) n'écrit plus de plan d'article : elle renvoie vers la fiche.
- Un article d'avant 0103 n'a pas de rôles : il garde ses numéros, et le menu ⋮
  permet de désigner son introduction et sa conclusion.
