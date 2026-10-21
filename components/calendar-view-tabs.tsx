"use client";

import { CalendarDays, LayoutList, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { ViewTab, ViewTabs } from "@/components/ui/view-tabs";

export type CalendarView = "calendar" | "planning" | "ideas";

/**
 * Les trois vues du planning : Calendrier · Planning · Idées. Le dessin et
 * l'attente au clic vivent dans `components/ui/view-tabs.tsx`, partagés avec
 * la page Tâches.
 */
export function CalendarViewTabs({
  view,
  month,
  platform,
  showIdeas,
}: {
  view: CalendarView;
  month: string;
  /** Conservé d'un onglet à l'autre : sinon le filtre se perd au retour. */
  platform?: string;
  /** Faux pour un client invité : les idées sont le brouillon interne. */
  showIdeas: boolean;
}) {
  const t = useTranslations("calendar");
  const query = (v: CalendarView) =>
    `?m=${month}&view=${v}${platform ? `&platform=${encodeURIComponent(platform)}` : ""}`;

  return (
    <ViewTabs>
      <ViewTab
        href={query("calendar")}
        active={view === "calendar"}
        icon={<CalendarDays className="size-4 shrink-0 max-sm:hidden" aria-hidden />}
      >
        {t("tabs.calendar")}
      </ViewTab>
      <ViewTab
        href={query("planning")}
        active={view === "planning"}
        icon={<LayoutList className="size-4 shrink-0 max-sm:hidden" aria-hidden />}
      >
        {t("tabs.planning")}
      </ViewTab>
      {showIdeas && (
        <ViewTab
          href={query("ideas")}
          active={view === "ideas"}
          icon={<Lightbulb className="size-4 shrink-0 max-sm:hidden" aria-hidden />}
        >
          {t("tabs.ideas")}
        </ViewTab>
      )}
    </ViewTabs>
  );
}
