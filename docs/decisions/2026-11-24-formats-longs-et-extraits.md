# Formats longs et extraits

**Date** : 24/11/2026 — **Statut** : accepté

## Contexte

Mariam veut que Kreatly produise aussi les contenus longs — vidéo longue, direct,
podcast, article — avec Krea dès le départ, et un système podcast complet.

## Décision

1. **Quatre formats, aucun statut nouveau.** `long_video` et `podcast` suivent la
   famille vidéo, `livestream` aussi mais sans Tournage ni Montage, `article` suit
   la famille simple. Les mots changent à l'affichage seulement (`statusWord` :
   Rédaction, Enregistrement, Préparation). `livestream` s'appelle « Direct » :
   « Live » est déjà le statut « c'est sorti ».
2. **Une table de capacités** (`FORMAT_SPECS`, `lib/constants.ts`) décide de tout ce
   qu'un format sait faire. `isSimpleType` portait trois décisions : un format
   oublié tombait en silence dans la famille vidéo.
3. **Une seule table, `content_sections`** (0101), pour chapitres, déroulé,
   questions et intertitres ; un seul éditeur (`LongformTab`) réglé par
   `lib/longform.ts`. L'invité et la transcription y sont deux lignes à part.
4. **Un extrait est un vrai contenu** (`contents.source_content_id`, 0100) : statut,
   date, validation, calendrier. La première idée — une liste d'extraits dans la
   fiche podcast — aurait fabriqué des Reels hors du cycle de vie. Supprimer la
   source laisse les extraits.
5. **Une citation est vérifiée** contre la source, à la proposition et à la
   création (`quoteIsInSource`) : on n'attribue pas à un invité une phrase qu'il
   n'a pas dite. Pas d'extrait sans matière (transcription, ou texte écrit).
6. **L'IA écrit long en deux temps** : un plan, puis une partie à la demande.
   Budget 90 s par appel, au lieu de 52 s du temps de Vercel.
7. **Le lien public passe en liste blanche** (0102). `to_jsonb(c.*)` envoyait des
   champs internes au navigateur ; et il manquait la voix off des vlogs, les
   visuels et les légendes. La transcription n'est lisible ni par le client
   (RLS : `is_brand_writer`), ni par le lien, ni à l'impression.

## Conséquences

- Ajouter un format = `CONTENT_TYPES` + `FORMAT_SPECS` + `PLATFORMS_BY_TYPE` +
  `messages/*.json` + une couleur + `contents_type_check`. Les tests
  (`lib/longform.test.ts`) échouent si l'un manque.
- `recompute_live_statuses` ne liste plus les formats.
- Une nouvelle action IA doit entrer dans `BRAND_GATED_ACTIONS`, sinon elle
  contourne l'interrupteur de la marque.
