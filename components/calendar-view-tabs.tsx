"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import {
  CalendarDays,
  LayoutList,
  Lightbulb,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type CalendarView = "calendar" | "planning" | "ideas";

/**
 * Les trois vues du planning : Calendrier · Planning · Idées.
 *
 * Composant client pour trois raisons :
 *
 *  1. Un clic d'onglet déclenche cinq requêtes serveur, dont un recalcul de
 *     statuts qui ÉCRIT. Sans retour visuel, c'est un clic mort — perçu comme
 *     une panne, pas comme une attente. (`app/(app)/loading.tsx` ne suffit
 *     pas : il ne se redéclenche pas quand seul `?view=` change.)
 *
 *  2. L'état actif n'est plus orange. L'orange est réservé à l'action, et le
 *     bouton de création est à l'autre bout de la même rangée : deux pastilles
 *     orange identiques, et on ne distingue plus « où je suis » de « ce que je
 *     fais ».
 *
 *  3. Les icônes disparaissent sous 640 px. Elles coûtent 22 px par onglet, et
 *     à trois onglets la rangée dépassait la largeur d'un téléphone — où elle
 *     était silencieusement ROGNÉE, le bandeau masquant son débordement.
 *     Les libellés restent : ce sont eux qui disent où l'on va.
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
    // `max-w-full` + défilement masqué : filet de sécurité si un libellé
    // s'allonge ou si la police tarde à charger. Même motif que `TabsList`.
    <div className="inline-flex max-w-full shrink-0 overflow-x-auto rounded-full border border-border bg-card p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Tab href={query("calendar")} active={view === "calendar"} icon={CalendarDays}>
        {t("tabs.calendar")}
      </Tab>
      <Tab href={query("planning")} active={view === "planning"} icon={LayoutList}>
        {t("tabs.planning")}
      </Tab>
      {showIdeas && (
        <Tab href={query("ideas")} active={view === "ideas"} icon={Lightbulb}>
          {t("tabs.ideas")}
        </Tab>
      )}
    </div>
  );
}

function Tab({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition sm:px-3.5",
        active
          ? "bg-secondary text-foreground shadow-sm"
          : "text-muted hover:text-foreground",
      )}
    >
      <TabIcon icon={icon} />
      {children}
    </Link>
  );
}

/**
 * L'icône, et elle seule, porte l'attente — et elle est rendue DANS le
 * `<Link>`, seule position où le contexte de `useLinkStatus` existe. Appelé
 * au-dessus, le hook lit la valeur par défaut et ne change jamais : c'est
 * l'erreur qui rendait la première version inopérante.
 *
 * Changer l'icône plutôt que l'apparence de la pastille, parce qu'un enfant
 * ne peut pas modifier la classe de son parent — et sur ordinateur la largeur
 * ne bouge pas, donc la rangée ne tremble pas.
 */
function TabIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <>
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        <span className="sr-only">Chargement…</span>
      </>
    );
  }
  return <Icon className="size-4 shrink-0 max-sm:hidden" aria-hidden />;
}
