import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  TrendingUp,
  MessageSquare,
  Check,
  Clock3,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import { KreaBadge } from "@/components/krea-avatar";
import { PageHeader } from "@/components/page-header";
import { KreaProgressPanel } from "@/components/krea-progress-panel";
import { ContentCard } from "@/components/content-card";
import { NewContentButton } from "@/components/new-content-modal";
import { DashboardFilters } from "@/components/dashboard-filters";
import { typeColor, typeLabel, platformLabel, isLiveStatus } from "@/lib/constants";
import type { Content } from "@/lib/types";

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  platform?: string;
  month?: string;
};

// Seuil "bravo" de la note coach — voir memory feedback_kreatly_coach_voice :
// la plateforme doit parler, pas juste afficher des chiffres bruts.
const MONTHLY_GOAL_THRESHOLD = 12;

type UpcomingRow = {
  id: string;
  title: string | null;
  type: string;
  date: string;
  platform: string | null;
  status: string;
};

type PerfPoint = { date: string | null; pillar: string | null; performances: { views: number | null } | { views: number | null }[] | null };

type RecentComment = {
  id: string;
  content_id: string;
  content_title: string | null;
  user_id: string | null;
  author_email: string | null;
  guest_name: string | null;
  is_guest: boolean;
  body: string;
  created_at: string;
};

/** "idea"/"design" = pas encore attaqué — le reste compte comme "en cours/prêt". */
function isReady(status: string) {
  return status !== "idea" && status !== "design";
}

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateBadgeParts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("fr-FR", { day: "2-digit" }),
    month: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
  };
}

function getViews(row: PerfPoint) {
  const p = row.performances;
  const single = Array.isArray(p) ? p[0] : p;
  return single?.views ?? 0;
}

function authorLabel(c: RecentComment) {
  if (c.is_guest) return c.guest_name?.trim() || "Invité";
  return c.author_email?.split("@")[0] ?? "—";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { active, role } = await resolveActiveBrand();
  if (!active) return null;
  // Un "viewer" (client invité) est cantonné au Calendrier.
  if (role === "viewer") redirect("/calendar");

  const t = await getTranslations("dashboard");
  const params = await searchParams;

  const supabase = await createClient();

  // Bascule en masse "programmed" → "live" (post/carrousel/infographie) dès
  // que leur date+heure de publication est dépassée — pas de tâche planifiée
  // dans cette app, donc on recalcule à chaque chargement de page (0041).
  await supabase.rpc("recompute_live_statuses", { p_brand_id: active.id });

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const todayISO = toLocalISODate(now);
  const weekAheadISO = toLocalISODate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
  );
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

  // KPIs + les 3 nouveaux modules "mission control" (Prochainement, mini
  // Analytics, Commentaires) — tout en parallèle, indépendant de la liste
  // filtrée plus bas.
  const [allRes, upcomingRes, perfRes, commentsRes, pillarsCountRes] = await Promise.all([
    supabase.from("contents").select("status, date").eq("brand_id", active.id),
    supabase
      .from("contents")
      .select("id, title, type, date, platform, status")
      .eq("brand_id", active.id)
      .gte("date", todayISO)
      .lt("date", weekAheadISO)
      .order("date", { ascending: true })
      .limit(6),
    supabase
      .from("contents")
      .select("date, pillar, performances(views)")
      .eq("brand_id", active.id),
    supabase.rpc("list_recent_brand_comments", {
      p_brand_id: active.id,
      p_limit: 4,
    }),
    // Pour le panneau de progression Krea (étape "thèmes créés") — juste un
    // compte, pas besoin des lignes.
    supabase
      .from("brand_pillars")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", active.id),
  ]);

  const allContents = allRes.data ?? [];
  const total = allContents.length;
  const drafts = allContents.filter((c) => !isLiveStatus(c.status)).length;
  const published = allContents.filter((c) => isLiveStatus(c.status)).length;
  const thisMonth = allContents.filter((c) => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return d >= startMonth && d < endMonth;
  }).length;

  const upcoming = (upcomingRes.data ?? []) as UpcomingRow[];

  // Panneau de progression Krea : masqué une fois les 3 vraies étapes
  // franchies, pour ne pas encombrer l'écran d'une marque déjà lancée.
  const hasThemes = (pillarsCountRes.count ?? 0) > 0;
  const hasContent = total > 0;
  const hasPublished = published > 0;
  const journeyComplete = hasThemes && hasContent && hasPublished;

  // Mini-Analytics : vues ce mois vs le précédent + pilier qui progresse le
  // plus (même logique que /analytics, en plus léger pour la carte).
  const perfRows = (perfRes.data ?? []) as PerfPoint[];
  let viewsCur = 0;
  let viewsPrev = 0;
  const pillarCur = new Map<string, number>();
  const pillarPrev = new Map<string, number>();
  for (const row of perfRows) {
    if (!row.date) continue;
    const key = row.date.slice(0, 7);
    const v = getViews(row);
    if (key === curMonthKey) {
      viewsCur += v;
      if (row.pillar) pillarCur.set(row.pillar, (pillarCur.get(row.pillar) ?? 0) + v);
    } else if (key === prevMonthKey) {
      viewsPrev += v;
      if (row.pillar) pillarPrev.set(row.pillar, (pillarPrev.get(row.pillar) ?? 0) + v);
    }
  }
  const viewsTrendPct =
    viewsPrev > 0 ? Math.round(((viewsCur - viewsPrev) / viewsPrev) * 100) : null;
  let trendingPillar: string | null = null;
  let bestDelta = 0;
  for (const [pillar, views] of pillarCur) {
    const delta = views - (pillarPrev.get(pillar) ?? 0);
    if (delta > bestDelta) {
      bestDelta = delta;
      trendingPillar = pillar;
    }
  }
  const hasAnalyticsData = viewsCur > 0 || viewsPrev > 0;

  const recentComments = (commentsRes.data ?? []) as RecentComment[];

  // Liste filtrée
  let query = supabase
    .from("contents")
    .select("*")
    .eq("brand_id", active.id);

  if (params.q) query = query.ilike("title", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.type) query = query.eq("type", params.type);
  if (params.platform) query = query.eq("platform", params.platform);
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    const next = new Date(y, m, 1);
    const monthStart = `${params.month}-01`;
    const monthEnd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    query = query.gte("date", monthStart).lt("date", monthEnd);
  }

  const { data: filtered } = await query
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const contents = (filtered ?? []) as Content[];

  const hasFilters = !!(
    params.q ||
    params.status ||
    params.type ||
    params.platform ||
    params.month
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={active.name}
        title={t("title")}
        subtitle={t("subtitle", { brand: active.name })}
        actions={<NewContentButton variant="accent" />}
      />

      {!journeyComplete && (
        <KreaProgressPanel
          brandId={active.id}
          hasThemes={hasThemes}
          hasContent={hasContent}
          hasPublished={hasPublished}
        />
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label={t("kpi.total")} value={total} accent />
        <Kpi label={t("kpi.drafts")} value={drafts} />
        <Kpi label={t("kpi.published")} value={published} />
        <Kpi label={t("kpi.thisMonth")} value={thisMonth} />
      </div>

      {thisMonth > MONTHLY_GOAL_THRESHOLD && (
        <div className="flex items-center gap-3 rounded-3xl bg-accent/10 px-5 py-3.5 text-sm text-foreground">
          <KreaBadge />
          <span>
            {t("coach.aboveThreshold", {
              count: thisMonth,
              threshold: MONTHLY_GOAL_THRESHOLD,
            })}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <CalendarClock className="size-4 text-accent" />
              {t("upcoming.title")}
            </h3>
            <Link
              href="/calendar"
              className="text-xs font-semibold text-muted hover:text-foreground"
            >
              {t("upcoming.seeAll")} →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {t("upcoming.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {upcoming.map((item) => {
                const { day, month } = dateBadgeParts(item.date);
                const ready = isReady(item.status);
                return (
                  <li key={item.id}>
                    <Link
                      href={`/content/${item.id}`}
                      className="flex items-center gap-3 py-2.5 hover:opacity-80"
                    >
                      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary/60">
                        <span className="text-sm font-bold leading-none">{day}</span>
                        <span className="text-[9px] font-medium uppercase text-muted">
                          {month}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-sm font-semibold"
                          dir="auto"
                        >
                          {item.title || "—"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: typeColor(item.type) }}
                          />
                          {typeLabel(item.type)}
                          {item.platform && <span>· {platformLabel(item.platform)}</span>}
                        </div>
                      </div>
                      {ready ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <Check className="size-3" />
                          {t("upcoming.ready")}
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          <Clock3 className="size-3" />
                          {t("upcoming.missing")}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <TrendingUp className="size-4 text-accent" />
                {t("miniAnalytics.title")}
              </h3>
              <Link
                href="/analytics"
                className="text-xs font-semibold text-muted hover:text-foreground"
              >
                {t("miniAnalytics.seeAll")} →
              </Link>
            </div>
            {!hasAnalyticsData ? (
              <p className="text-sm text-muted">{t("miniAnalytics.empty")}</p>
            ) : (
              <>
                {viewsTrendPct !== null && (
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-xl font-bold ${viewsTrendPct >= 0 ? "text-emerald-600" : "text-muted"}`}
                    >
                      {viewsTrendPct >= 0 ? "↗" : "↘"} {Math.abs(viewsTrendPct)}%
                    </span>
                  </div>
                )}
                <p className="mt-0.5 text-xs text-muted">{t("miniAnalytics.trendSub")}</p>
                {trendingPillar && (
                  <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-relaxed">
                    {t("miniAnalytics.highlightPillar", { pillar: trendingPillar })}
                  </p>
                )}
              </>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <MessageSquare className="size-4 text-accent" />
                {t("comments.title")}
              </h3>
              <Link
                href="/calendar?view=planning"
                className="text-xs font-semibold text-muted hover:text-foreground"
              >
                {t("comments.seeAll")} →
              </Link>
            </div>
            {recentComments.length === 0 ? (
              <p className="text-sm text-muted">{t("comments.empty")}</p>
            ) : (
              <ul className="space-y-2.5">
                {recentComments.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/content/${c.content_id}`}
                      className="flex items-start gap-2 text-xs hover:opacity-80"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold uppercase">
                        {authorLabel(c).charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1 truncate" dir="auto">
                        <b className="font-semibold">{authorLabel(c)} :</b>{" "}
                        <span className="text-muted">« {c.body} »</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <DashboardFilters />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">
          {hasFilters
            ? t("resultsCount", { count: contents.length })
            : t("recent")}
        </h2>
        {contents.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            {hasFilters ? (
              <>
                <p className="text-base font-medium">{t("noResultsTitle")}</p>
                <p className="text-sm text-muted">
                  {t("noResultsSubtitle")}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-medium">{t("emptyTitle")}</p>
                <p className="text-sm text-muted">
                  {t("emptySubtitle")}
                </p>
                <div className="mt-2">
                  <NewContentButton />
                </div>
              </>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contents.map((c) => (
              <ContentCard key={c.id} content={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card
      className={
        "p-5 " +
        // shadow-glow remplace une ombre codée en dur qui utilisait encore
        // l'ANCIEN orange (#FF6B35) — désormais alignée sur la charte.
        (accent
          ? "border-0 bg-accent text-accent-foreground shadow-glow hover:shadow-glow"
          : "")
      }
    >
      <div
        className={
          "text-xs font-bold uppercase tracking-wider " +
          (accent ? "text-accent-foreground/85" : "text-muted")
        }
      >
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}
