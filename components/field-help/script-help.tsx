"use client";

import {
  FieldHelp,
  HelpSection,
  HelpList,
  HelpCallout,
} from "@/components/ui/field-help";

/**
 * Aide "Structure du script" — accessible depuis le bouton i à côté du
 * titre dans l'onglet Script d'un Reel. Explique en bref la structure
 * narrative en 3 phases (Ouverture / Développement / Clôture) que la
 * plateforme guide.
 *
 * Texte hardcodé en FR pour la démo. Migration i18n plus tard si besoin.
 */
export function ScriptHelp() {
  return (
    <FieldHelp
      title="Structure d'un bon Reel"
      description="Un Reel qui retient suit une narration en 3 phases. Mohtawa te guide à chaque étape."
    >
      <HelpSection title="Le principe">
        <p>
          Un Reel performant suit la même grammaire qu&apos;un bon film ou un
          bon article : <strong>capter</strong> (Ouverture) →{" "}
          <strong>apporter de la valeur</strong> (Développement) →{" "}
          <strong>conclure</strong> (Clôture). Ces 3 phases sont visibles
          comme dividers fins dans l&apos;onglet Script.
        </p>
      </HelpSection>

      <HelpSection title="🎬 Ouverture · 10-15s">
        <p>
          La phase qui décide si on continue à regarder ou si on scroll.
        </p>
        <HelpList
          items={[
            <>
              <strong>Hook</strong> (rappelé en haut, défini dans le Plan) : la
              phrase qui arrête le scroll en 1-2 secondes.
            </>,
            <>
              <strong>Intro</strong> : la promesse — qu&apos;est-ce que le
              viewer va apprendre / vivre dans cette vidéo ?
            </>,
          ]}
        />
      </HelpSection>

      <HelpSection title="💡 Développement · 30-45s">
        <p>Le cœur de ta valeur. 3 points maximum, c&apos;est la règle d&apos;or.</p>
        <HelpList
          items={[
            <>
              <strong>Point 1</strong> : ton argument le plus fort. Commence par
              là, jamais par le plus faible.
            </>,
            <>
              <strong>Point 2</strong> : ajoute, contraste ou approfondis le
              point 1.
            </>,
            <>
              <strong>Point 3</strong> : l&apos;effet « aha » final, celui qu&apos;on
              retient surtout.
            </>,
            <>
              <strong>Transition / B-roll</strong> : les plans visuels qui
              aèrent la prise de parole — insert, démo, capture d&apos;écran,
              action.
            </>,
          ]}
        />
      </HelpSection>

      <HelpSection title="🎯 Clôture · 10-15s">
        <p>La phase qui transforme le viewer en abonné, en commentaire, en sauvegarde.</p>
        <HelpList
          items={[
            <>
              <strong>Récap</strong> : synthétise en 1 phrase pour ancrer le
              take-away. C&apos;est ce qu&apos;on garde en mémoire.
            </>,
            <>
              <strong>Outro</strong> : le call-to-action — commente, sauvegarde,
              suis, partage à quelqu&apos;un.
            </>,
          ]}
        />
      </HelpSection>

      <HelpSection title="Règles d'or">
        <HelpList
          items={[
            "Une idée par bloc, pas deux. La précision bat la quantité.",
            "30 à 75 secondes total pour un Reel qui performe. L'estimation en haut t'indique où tu en es.",
            "Le compteur de mots par bloc (≈ 4 mots/seconde en français parlé) t'aide à respecter le timing.",
          ]}
        />
      </HelpSection>

      <HelpCallout variant="tip">
        Tu peux laisser un bloc vide si la scène ne s&apos;y prête pas — le
        bouton <strong>« Générer avec l&apos;IA »</strong> peut aussi remplir
        toute la structure d&apos;un coup pour t&apos;inspirer.
      </HelpCallout>
    </FieldHelp>
  );
}
