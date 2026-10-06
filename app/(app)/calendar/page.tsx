import Link from "next/link";
import {
  CalendarDays,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lightbulb,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { CalendarMonth, type CalendarEntry } from "@/components/calendar-month";
import { CalendarQuickCreate } from "@/components/calendar-quick-create";
import { CalendarPlatformFilter } from "@/components/calendar-platform-filter";
import { PlanningTable } from "@/components/planning-table";
import { IdeasBoard, type IdeaCard } from "@/components/ideas-board";
import { PageHeader } from "@/components/page-header";
import { fetchThumbnails } from "@/lib/thumbnails";
import type { Content } from "@/lib/types";

/** Ligne brute renvoyée par la requête publications × contenu (join !inner). */
type PublicationJoinRow = {
  id: string;
  content_id: string;
  platform: string;
  scheduled_date: string;
  scheduled_time: string | null;
  contents: {
    id: string;
    title: string | null;
    type: string;
    pillar: string | null;
    status: string;
  };
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; view?: string; platform?: string }>;
}) {
  const { active, role } = await resolveActiveBrand();
  if (!active) return null;

  // Un "viewer" (client invité) regarde le planning, il ne le fabrique pas.
  const isClient = role === "viewer";

  const t = await getTranslations("calendar");
  const params = await searchParams;
  const now = new Date();
  const ym =
    params.m && /^\d{4}-\d{2}$/.test(params.m)
      ? params.m
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // L'onglet Idées n'existe pas pour un client invité : c'est le brouillon
  // interne. Le garde est ici ET à l'affichage de l'onglet — une URL se tape.
  const requestedView = params.view ?? "calendar";
  const view =
    requestedView === "planning"
      ? "planning"
      : requestedView === "ideas" && role !== "viewer"
        ? "ideas"
        : "calendar";
  const platformFilter = params.platform || "";

  const monthStart = `${ym}-01`;
  const [year, month] = ym.split("-").map(Number);
  const nextMonth = new Date(year, month, 1); // month 1-based → JS 0-based = mois suivant
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const prev = new Date(year, month - 2, 1);
  const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const nextYm = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const supabase = await createClient();

  // Ces quatre requêtes ne dépendent pas les unes des autres : les enchaîner
  // coûtait quatre allers-retours là où un seul suffit. Sur une base hébergée
  // loin du serveur, c'est l'essentiel du temps d'attente.
  //
  // `recompute_live_statuses` fait exception à une règle : il ÉCRIT (bascule
  // en "live" ce dont la date est passée) pendant qu'on lit. Au pire, un
  // contenu qui vient de passer live s'affiche encore "Programmé" jusqu'au
  // prochain affichage — bien moins gênant qu'une seconde d'attente, et il
  // n'existe pas de tâche planifiée pour le faire ailleurs (0041).
  const [, unreadRes, awaitingRes, contentsRes] = await Promise.all([
    supabase.rpc("recompute_live_statuses", { p_brand_id: active.id }),

    // Compteurs de non-lus pour le badge des commentaires (Calendrier +
    // Planning) — 1 seul appel groupé, pas une requête par contenu affiché.
    supabase.rpc("count_unread_comments"),

    // Ce qui attend le client, tous mois confondus : une validation en retard
    // d'un mois ne doit pas disparaître parce qu'il a changé de page.
    isClient
      ? supabase
          .from("contents")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", active.id)
          .eq("status", "pending_review")
      : Promise.resolve({ count: 0 }),

    supabase
      .from("contents")
      .select("*")
      .eq("brand_id", active.id)
      .gte("date", monthStart)
      .lt("date", monthEnd),
  ]);

  const commentCounts: Record<string, number> = {};
  for (const row of (unreadRes.data ?? []) as {
    content_id: string;
    unread_count: number;
  }[]) {
    commentCounts[row.content_id] = row.unread_count;
  }

  const awaitingCount = awaitingRes.count ?? 0;
  const contents = (contentsRes.data ?? []) as Content[];

  // Vue calendrier uniquement : une carte par (contenu × plateforme), sur SA
  // propre date — pas juste la date "primaire" legacy de contents.date.
  // Les idées : tout ce qui n'a pas encore de date, quel que soit le mois
  // affiché. Une idée n'appartient à aucun mois — c'est justement ce qui la
  // distingue d'un contenu placé.
  const { data: ideasData } =
    view === "ideas"
      ? await supabase
          .from("contents")
          .select("id, title, type, pillar, status, notes")
          .eq("brand_id", active.id)
          .is("date", null)
          .order("created_at", { ascending: false })
      : { data: [] };
  const ideas = (ideasData ?? []) as IdeaCard[];

  let entries: CalendarEntry[] = [];
  // `=== "calendar"` et non `!== "planning"` : sans ça, l'onglet Idées paierait
  // les requêtes de publications et de vignettes dont il ne se sert pas.
  if (view === "calendar") {
    let pubsQuery = supabase
      .from("content_publications")
      .select(
        "id, content_id, platform, scheduled_date, scheduled_time, contents!inner(id, brand_id, title, type, pillar, status)",
      )
      .eq("contents.brand_id", active.id)
      .gte("scheduled_date", monthStart)
      .lt("scheduled_date", monthEnd);
    if (platformFilter) pubsQuery = pubsQuery.eq("platform", platformFilter);
    const { data: pubsData } = await pubsQuery;

    const pubs = (pubsData ?? []) as unknown as PublicationJoinRow[];
    const publishedContentIds = new Set(pubs.map((p) => p.content_id));

    entries = [
      ...pubs.map((p) => ({
        key: p.id,
        contentId: p.content_id,
        publicationId: p.id,
        platform: p.platform,
        scheduledDate: p.scheduled_date,
        scheduledTime: p.scheduled_time,
        title: p.contents.title,
        type: p.contents.type,
        pillar: p.contents.pillar,
        status: p.contents.status,
      })),
      // Contenus datés sans plateforme choisie (ou sans publication associée,
      // cas legacy) — affichés sans icône, SAUF si un filtre plateforme est
      // actif (dans ce cas ils ne correspondent à aucune plateforme précise).
      ...(platformFilter
        ? []
        : contents
            .filter((c) => c.date && !publishedContentIds.has(c.id))
            .map((c) => ({
              key: c.id,
              contentId: c.id,
              publicationId: null,
              platform: null,
              scheduledDate: c.date as string,
              scheduledTime: null,
              title: c.title,
              type: c.type,
              pillar: c.pillar,
              status: c.status,
            }))),
    ];

    // Les vignettes en dernier : on ne les cherche QUE pour les contenus
    // réellement affichés ce mois-ci, filtre plateforme compris.
    const thumbs = await fetchThumbnails(
      supabase,
      [...new Set(entries.map((e) => e.contentId))],
    );
    entries = entries.map((e) => ({
      ...e,
      thumbUrl: thumbs.get(e.contentId) ?? null,
    }));
  }

  // Le Planning montre les mêmes contenus, en tableau : il a besoin des
  // mêmes vignettes. Elles n'étaient chargées que dans la branche ci-dessus,
  // donc la colonne restait vide dès qu'on changeait d'onglet.
  const planningThumbs =
    view === "planning"
      ? Object.fromEntries(
          await fetchThumbnails(supabase, contents.map((c) => c.id)),
        )
      : {};

  const tabCls = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
      on
        ? "bg-accent text-accent-foreground"
        : "text-muted hover:text-foreground",
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actionsClassName="w-full"
        actions={
          // Tout sur UNE ligne : en `flex-wrap`, les 6 boutons de création
          // passaient à la ligne sous les onglets. Ici la barre ne se coupe
          // jamais — sur écran étroit elle défile horizontalement.
          <div className="-mb-1 flex w-full items-center gap-2 overflow-x-auto pb-1">
            <div className="inline-flex shrink-0 rounded-full border border-border bg-card p-0.5">
              <Link href={`?m=${ym}&view=calendar`} className={tabCls(view === "calendar")}>
                <CalendarDays className="size-4" />
                Calendrier
              </Link>
              <Link href={`?m=${ym}&view=planning`} className={tabCls(view === "planning")}>
                <LayoutList className="size-4" />
                Planning
              </Link>
              {!isClient && (
                <Link href={`?m=${ym}&view=ideas`} className={tabCls(view === "ideas")}>
                  <Lightbulb className="size-4" />
                  Idées
                </Link>
              )}
            </div>
            {view === "calendar" && <CalendarPlatformFilter />}
            {!isClient && <CalendarQuickCreate />}
          </div>
        }
      />

      {isClient && (awaitingCount ?? 0) > 0 && (
        <Link
          href="/review"
          className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-accent/30 bg-accent/10 px-5 py-4 transition-colors hover:bg-accent/15"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <Eye className="size-4 shrink-0 text-accent" />
            {awaitingCount === 1
              ? "Un contenu attend ton avis."
              : `${awaitingCount} contenus attendent ton avis.`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground">
            Les voir
            <ChevronRight className="size-3.5 rtl-flip" />
          </span>
        </Link>
      )}

      {view === "ideas" ? (
        <IdeasBoard ideas={ideas} />
      ) : view === "planning" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Link
              href={`?m=${prevYm}&view=planning`}
              className="inline-flex size-8 items-center justify-center rounded-full border border-border text-muted transition hover:bg-secondary hover:text-foreground"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="size-4 rtl-flip" />
            </Link>
            <span className="min-w-40 text-center text-sm font-semibold capitalize">
              {monthLabel}
            </span>
            <Link
              href={`?m=${nextYm}&view=planning`}
              className="inline-flex size-8 items-center justify-center rounded-full border border-border text-muted transition hover:bg-secondary hover:text-foreground"
              aria-label="Mois suivant"
            >
              <ChevronRight className="size-4 rtl-flip" />
            </Link>
          </div>
          <PlanningTable
            contents={contents}
            commentCounts={commentCounts}
            thumbs={planningThumbs}
          />
        </div>
      ) : (
        <CalendarMonth
          initialMonth={monthStart}
          entries={entries}
          commentCounts={commentCounts}
          canEdit={!isClient}
        />
      )}
    </div>
  );
}
