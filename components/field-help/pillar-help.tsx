"use client";

import {
  FieldHelp,
  HelpSection,
  HelpList,
  HelpCallout,
} from "@/components/ui/field-help";

/**
 * Guide "Pilier de contenu" — accessible depuis le bouton i à côté du label
 * dans l'onglet Plan d'une vidéo.
 *
 * Objectif : aider un créateur débutant à structurer 3 à 5 piliers solides
 * avant de produire ses Reels / Stories.
 */
export function PillarHelp() {
  return (
    <FieldHelp
      title="Pilier de contenu"
      description="Les thématiques phares de ta marque. Bien choisis, ils transforment un compte qui poste au hasard en vraie stratégie."
      videoUrl="https://youtu.be/fgy-JgY0Q3I"
    >
      <HelpSection title="C'est quoi, concrètement ?">
        <p>
          Un pilier de contenu est une <strong>grande thématique</strong> que
          tu vas couvrir <strong>régulièrement</strong>. Considère-le comme
          une colonne de ta stratégie : chaque vidéo que tu produis doit
          pouvoir être rangée dans <strong>un</strong> pilier.
        </p>
        <p>
          La règle d'or :{" "}
          <strong>entre 3 et 5 piliers maximum</strong>. Moins, tu vas vite
          tourner en rond. Plus, ton audience ne comprendra plus de quoi tu
          parles.
        </p>
      </HelpSection>

      <HelpSection title="La méthode en 5 étapes">
        <HelpList
          ordered
          items={[
            <>
              <strong>Pose ton objectif et ta cible.</strong> Pourquoi tu
              communiques (notoriété, communauté, ventes) ? À qui tu parles
              (problèmes, besoins, contenus qu'il consomme déjà) ? Sans ça,
              les piliers ne servent à rien.
            </>,
            <>
              <strong>Brainstorme en vrac.</strong> Liste tout : conseils que
              tu donnes, questions de clients, coulisses, anecdotes,
              opinions. Sans te censurer. Vise 30-50 idées brutes.
            </>,
            <>
              <strong>Regroupe en 3 à 5 piliers.</strong> Range tes idées par
              grandes familles. Si une famille n'a que 3-4 idées → c'est pas
              un pilier, c'est un sujet ponctuel.
            </>,
            <>
              <strong>Équilibre tes piliers</strong> selon la méthode{" "}
              <em>Know-Like-Trust</em> :
              <HelpList
                items={[
                  <>
                    <strong>Éducatif</strong> — tu démontres ton expertise
                    (conseils, tutos)
                  </>,
                  <>
                    <strong>Relationnel</strong> — tu montres les coulisses,
                    l'équipe, ton quotidien
                  </>,
                  <>
                    <strong>Inspirant</strong> — tes valeurs, ta vision, ce
                    qui fait réagir
                  </>,
                  <>
                    <strong>Promotionnel</strong> — tes offres, tes
                    résultats, tes témoignages clients
                  </>,
                ]}
              />
            </>,
            <>
              <strong>Crée ta banque d'idées.</strong> Dans Mohtawa, chaque
              pilier devient un filtre : tu pourras y rattacher tes Reels et
              Stories à mesure que les idées arrivent.
            </>,
          ]}
        />
      </HelpSection>

      <HelpSection title="Le test de validation">
        <HelpCallout variant="tip">
          Pour chaque pilier, demande-toi :{" "}
          <strong>
            « Est-ce que je peux générer au moins 30 idées de vidéos sans
            transpirer ? »
          </strong>{" "}
          Si oui → c'est un vrai pilier. Si non → fusionne-le avec un autre
          ou abandonne-le.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="3 exemples concrets">
        <HelpList
          items={[
            <>
              <strong>Coach business</strong> — Astuces marketing
              (éducatif), Routine entrepreneur (coulisses), Mindset &
              discipline (inspirant), Témoignages clients (promo)
            </>,
            <>
              <strong>Marque de cosmétiques naturels</strong> — Conseils
              beauté (éducatif), Fabrication en atelier (coulisses), Zéro
              déchet & valeurs (inspirant), Présentation produits (promo)
            </>,
            <>
              <strong>Restaurant local</strong> — Recettes & techniques
              (éducatif), Une journée en cuisine (coulisses), Producteurs
              locaux qu'on soutient (inspirant), Plat du jour & événements
              (promo)
            </>,
          ]}
        />
      </HelpSection>

      <HelpSection title="Comment Mohtawa utilise tes piliers">
        <HelpList
          items={[
            <>
              Tu retrouves la liste dans le menu déroulant{" "}
              <strong>« Pilier de contenu »</strong> de chaque vidéo (juste
              au-dessus).
            </>,
            <>
              Le bouton orange <strong>+</strong> à droite du menu te permet
              d'en ajouter un nouveau à la volée, sans quitter la fiche
              vidéo.
            </>,
            <>
              Dans l'onglet <strong>Analytics</strong>, tes piliers sont
              classés par performance : tu vois lequel ramène le plus de
              vues et tu peux doubler la mise dessus.
            </>,
            <>
              Tu peux gérer toute ta taxonomie (ajouter, renommer,
              supprimer) depuis la page <strong>Marques → [ta marque]</strong>.
            </>,
          ]}
        />
      </HelpSection>

      <HelpCallout variant="info">
        <strong>Conseil :</strong> commence avec <strong>3 piliers</strong>{" "}
        seulement. Tu pourras toujours en ajouter un 4ᵉ ou 5ᵉ plus tard, une
        fois que tu maîtrises les premiers.
      </HelpCallout>
    </FieldHelp>
  );
}
