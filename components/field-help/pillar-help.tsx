"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("fieldHelp.pillar");

  return (
    <FieldHelp
      title="Thèmes de contenu"
      description={t("description")}
      videoUrl="https://youtu.be/fgy-JgY0Q3I"
    >
      <HelpSection title={t("whatIs")}>
        <p>{t("whatIsP1")}</p>
        <p>{t("whatIsP2")}</p>
      </HelpSection>

      <HelpSection title={t("methodTitle")}>
        <HelpList
          ordered
          items={[
            t("step1"),
            t("step2"),
            t("step3"),
            <>
              {t("step4Intro")}
              <HelpList
                items={[
                  t("step4a"),
                  t("step4b"),
                  t("step4c"),
                  t("step4d"),
                ]}
              />
            </>,
            t("step5"),
          ]}
        />
      </HelpSection>

      <HelpSection title={t("testTitle")}>
        <HelpCallout variant="tip">{t("test")}</HelpCallout>
      </HelpSection>

      <HelpSection title={t("examplesTitle")}>
        <HelpList
          items={[t("example1"), t("example2"), t("example3")]}
        />
      </HelpSection>

      <HelpSection title={t("mohtawaTitle")}>
        <HelpList
          items={[
            t("mohtawa1"),
            t("mohtawa2"),
            t("mohtawa3"),
            t("mohtawa4"),
          ]}
        />
      </HelpSection>

      <HelpCallout variant="info">{t("tip")}</HelpCallout>
    </FieldHelp>
  );
}
