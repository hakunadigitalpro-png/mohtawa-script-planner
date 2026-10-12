# 2026-10-12 — Le statut d'un contenu change par un geste explicite

**Statut :** accepté. Remplace l'auto-progression de la migration 0015.

## Contexte

Le statut d'un contenu avait deux moteurs qui s'ignoraient :

- une RPC `recompute_content_status` (0015) qui lisait `reel_details.checklist.script_ready` et `.edited` — écrits seulement par un onglet Checklist retiré de l'affichage — et dont les rangs s'arrêtaient à `published` : elle ne connaissait ni `approved`, ni `live`, ni la boucle client, ni les statuts des formats simples ;
- un verrou `contents.auto_status` que chaque changement manuel passait à `false`, coupant la seule règle encore vivante (une scène filmée → Tournage) dès qu'on touchait au statut une fois.

Résultat : un badge « ✨ Auto » qui promettait une progression inexistante, cinq gestes pour passer de Validé à Programmé, et un contenu qu'on oubliait de programmer ne passait jamais en ligne. L'analyse du parcours (PARCOURS-UTILISATEUR.md, constats 2, 6, 10, 14, 19) en a fait le premier chantier.

## Options envisagées

1. **Réparer la RPC** en remettant l'onglet Checklist et en lui apprenant les nouveaux statuts. Une étape de plus pour faire vivre un automatisme que personne ne demandait ; et deux moteurs de plus en plus loin l'un de l'autre.
2. **Tout manuel** : retirer l'automatisme, garder le menu Statut. Honnête, mais le passage Validé → Programmé → En ligne restait un détour, et la règle « filmé → Tournage » qui marchait disparaissait.
3. **Un seul moteur en TypeScript, et un bouton** : la logique pure et testée dans `lib/content-lifecycle.ts`, un bouton d'en-tête qui propose la prochaine étape, l'automatisme réduit à ce qui est un fait (une scène filmée, une date passée).

## Décision

Option 3.

- **Un statut change par un geste explicite, ou par le temps qui passe.** Les gestes : choisir le format, marquer filmé, envoyer au client, la décision du client, « C'est programmé », « C'est en ligne ». Le temps : `recompute_live_statuses` (0041/0045), à la lecture.
- **Une règle vaut par tous les chemins.** « Programmé » exige une publication datée — le bouton la demande, le menu Statut la refuse sans elle. Le menu Statut et le ⋮ des cartes restent comme correction manuelle assumée.
- **Validé avec une date passée propose « C'est en ligne »**, pas une date à inventer : la cible poste à la main le jour J.
- **On retire** la RPC, `auto_status`, `reel_details.checklist`, l'onglet Checklist (migration 0058).
- **« Prêt » dit vrai** (matière + hors écriture + pas « À réviser ») et **le retard est nommé** par Krea, avec la sortie dans la phrase.

## Conséquences

- Les statuts se lisent dans un seul fichier, avec leurs tests ; une règle nouvelle s'écrit là, pas dans une RPC.
- Le trigger 0046 (notification « pense à le programmer ») fonctionne sans changement : il écoute le statut, pas celui qui l'a posé.
- Un contenu passé « Programmé » à la main sans date est désormais refusé — c'était la porte par laquelle les contenus disparaissaient.
- La migration 0058 se joue après le déploiement du code (v99) : le code ne lit plus ces colonnes, elles peuvent exister ou non.
- Le chantier 2 (contexte de marque, garde « as-tu un client invité ? ») branchera sa raison sur le même bouton, sans en ajouter un.
