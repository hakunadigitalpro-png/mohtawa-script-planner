import Link from "next/link";
import { TrendingUp, BarChart3, Sparkles, Target, Award } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BarChart, type BarPoint } from "@/components/charts/bar-chart";
import { RankedList, type RankedItem } from "@/components/charts/ranked-list";
import { platformLabel, typeLabel, typeColor } from "@/lib/constants";

type PerfRow = { views: number | null; likes: number | null } | null;
type ContentWithPerf = {
  id: string;
  title: string | null;
  date: string | null;
  type: string;
  platform: string | null;
  pillar: string | null;
  status: string;
  performances: PerfRow | PerfRow[] | null;
};

function getPerf(c: ContentWithPerf): PerfRow {
  const p = c.performances;
  if (!p) return null;
  if (Array.isArray(p)) return p[0] ?? null;
  return p;
}
const getViews = (c: ContentWithPerf) => getPerf(c)?.views ?? 0;

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}
function lastNMonths(n: number) {
  const arr: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
}
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

type Aggregate = {
  total: number;
  count: number;
};

function aggregateBy<T extends string>(
  rows: ContentWithPerf[],
  key: (c: ContentWithPerf) => T | null,
): Map<T, Aggregate> {
  const out = new Map<T, Aggregate>();
  for (const c of rows) {
    const k = key(c);
    if (k == null || k === "") continue;
    const v = getViews(c);
    const prev = out.get(k) ?? { total: 0, count: 0 };
    out.set(k, { total: prev.total + v, count: prev.count + 1 });
  }
  return out;
}

function toRankedItems<T extends string>(
  agg: Map<T, Aggregate>,
  toLabel: (key: T) => string,
): RankedItem[] {
  return Array.from(agg.entries()).map(([key, { total, count }]) => {
    const avg = count > 0 ? Math.round(total / count) : 0;
    return {
      key,
      label: toLabel(key),
      value: total,
      secondary: `${count} vidéo${count > 1 ? "s" : ""} · moy. ${fmtCompact(avg)} vues`,
    };
  });
}

export default async function AnalyticsPage() {
  const { active } = await resolveActiveBrand();
  if (!active) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    .select(
      "id, title, date, type, platform, pillar, status, performances(views, likes)",
    )
    .eq("brand_id", active.id);

  const rows = (data ?? []) as ContentWithPerf[];

  // ============== Aggrégats principaux ==============
  const byPillar = aggregateBy(rows, (c) => c.pillar);
  const byPlatform = aggregateBy(rows, (c) => c.platform);
  const byType = aggregateBy(rows, (c) => c.type);

  const pillarItems = toRankedItems(byPillar, (k) => k);
  const platformItems = toRankedItems(byPlatform, (k) => platformLabel(k));
  const typeItems = toRankedItems(byType, (k) => typeLabel(k));

  // Top 5 vidéos par vues
  const topVideos = rows
    .map((c) => ({
      id: c.id,
      title: c.title || "Sans titre",
      pillar: c.pillar,
      platform: c.platform,
      type: c.type,
      views: getViews(c),
    }))
    .filter((v) => v.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  // ============== Charts mensuels ==============
  const months = lastNMonths(6);
  const viewsByMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  for (const c of rows) {
    if (!c.date) continue;
    const key = monthKey(c.date);
    if (!(key in viewsByMonth)) continue;
    viewsByMonth[key] += getViews(c);
  }
  const viewsData: BarPoint[] = months.map((m) => ({
    label: monthLabel(m),
    value: viewsByMonth[m] ?? 0,
  }));

  const publishedByMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  for (const c of rows) {
    if (c.status !== "published" || !c.date) continue;
    const key = monthKey(c.date);
    if (!(key in publishedByMonth)) continue;
    publishedByMonth[key] += 1;
  }
  const publishedData: BarPoint[] = months.map((m) => ({
    label: monthLabel(m),
    value: publishedByMonth[m] ?? 0,
  }));

  // ============== KPIs ==============
  const totalViews = rows.reduce((s, c) => s + getViews(c), 0);
  const totalPublished = rows.filter((c) => c.status === "published").length;
  const withStats = rows.filter((c) => getViews(c) > 0).length;
  const hasAnyPerf = totalViews > 0;

  // Tendance pilier : compare le mois courant vs mois précédent (par vues)
  const trendingPillar = (() => {
    if (pillarItems.length === 0) return null;
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prev = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    const curMap = new Map<string, number>();
    const prevMap = new Map<string, number>();
    for (const c of rows) {
      if (!c.pillar || !c.date) continue;
      const k = monthKey(c.date);
      const v = getViews(c);
      if (k === cur) curMap.set(c.pillar, (curMap.get(c.pillar) ?? 0) + v);
      if (k === prev) prevMap.set(c.pillar, (prevMap.get(c.pillar) ?? 0) + v);
    }

    let bestPillar: string | null = null;
    let bestDelta = -Infinity;
    for (const [p, v] of curMap) {
      const delta = v - (prevMap.get(p) ?? 0);
      if (delta > bestDelta) {
        bestDelta = delta;
        bestPillar = p;
      }
    }
    if (!bestPillar || bestDelta <= 0) return null;
    return { pillar: bestPillar, delta: bestDelta };
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted">
          {active.name} · ce que tu mesures, tu peux l&apos;améliorer.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          icon={<BarChart3 className="size-4" />}
          label="Total vues"
          value={fmtCompact(totalViews)}
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Vidéos publiées"
          value={String(totalPublished)}
        />
        <KpiCard
          icon={<Sparkles className="size-4" />}
          label="Vidéos avec stats"
          value={String(withStats)}
        />
      </div>

      {!hasAnyPerf && (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-secondary p-2 text-muted">
              <BarChart3 className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">
                Pas encore de données de performance
              </h3>
              <p className="mt-1 text-xs text-muted">
                Pour voir tes analytics se remplir, va sur une vidéo publiée et
                renseigne les <strong>Performances</strong> (vues, likes, partages...).
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Classement principal : par pilier */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-amber-500" />
                Quels sujets performent le mieux ?
              </CardTitle>
              <CardDescription>
                Classement par pilier de contenu — pour savoir de quoi reparler.
              </CardDescription>
            </div>
            {trendingPillar && (
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                ↗ <span className="font-semibold">{trendingPillar.pillar}</span> en
                progression (+{fmtCompact(trendingPillar.delta)} vues ce mois)
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <RankedList
            items={pillarItems}
            color="var(--color-reel)"
            emptyLabel="Renseigne le pilier de contenu sur tes vidéos pour voir le classement."
            format="compact"
          />
        </CardContent>
      </Card>

      {/* Deux classements secondaires côte à côte */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Par plateforme</CardTitle>
            <CardDescription>Où ton contenu marche le mieux.</CardDescription>
          </CardHeader>
          <CardContent>
            <RankedList
              items={platformItems}
              color="var(--color-status-scheduled)"
              emptyLabel="Aucune plateforme renseignée."
              format="compact"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Par format</CardTitle>
            <CardDescription>Reel vs Story — le format qui paie.</CardDescription>
          </CardHeader>
          <CardContent>
            <RankedList
              items={typeItems.map((i) => ({
                ...i,
                label: i.label,
              }))}
              color="var(--color-story)"
              emptyLabel="—"
              format="compact"
            />
          </CardContent>
        </Card>
      </div>

      {/* Top 5 vidéos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="size-4 text-amber-500" />
            Top 5 vidéos
          </CardTitle>
          <CardDescription>Les vidéos qui ont le plus marché.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {topVideos.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted">
              Pas encore de vidéo avec des vues renseignées.
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {topVideos.map((v, i) => (
                <li key={v.id}>
                  <Link
                    href={`/content/${v.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-accent/50"
                  >
                    <span className="w-6 text-center text-sm font-bold text-muted">
                      #{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {v.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: typeColor(v.type) }}
                        >
                          ●{" "}
                          <span className="text-muted">{typeLabel(v.type)}</span>
                        </span>
                        {v.platform && <span>· {platformLabel(v.platform)}</span>}
                        {v.pillar && <span>· {v.pillar}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">
                      {fmtCompact(v.views)} vues
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Charts mensuels (en bas, contexte temporel) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vues par mois</CardTitle>
            <CardDescription>Cumul sur les 6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={viewsData} color="var(--color-reel)" format="compact" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vidéos publiées par mois</CardTitle>
            <CardDescription>Évolution de ta cadence</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={publishedData} color="var(--color-status-published)" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Card>
  );
}
