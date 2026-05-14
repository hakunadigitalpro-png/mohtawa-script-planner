import Link from "next/link";
import { TrendingUp, BarChart3, Globe, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BarChart, type BarPoint } from "@/components/charts/bar-chart";
import { platformLabel } from "@/lib/constants";

type ContentWithPerf = {
  id: string;
  title: string | null;
  date: string | null;
  platform: string | null;
  pillar: string | null;
  status: string;
  performances: { views: number | null; likes: number | null }[] | null;
};

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
    arr.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return arr;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default async function AnalyticsPage() {
  const { active } = await resolveActiveBrand();
  if (!active) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    .select(
      "id, title, date, platform, pillar, status, performances(views, likes)",
    )
    .eq("brand_id", active.id);

  const rows = (data ?? []) as ContentWithPerf[];

  const months = lastNMonths(6);

  // Vues par mois ----------------------------------------------------
  const viewsByMonth: Record<string, number> = Object.fromEntries(
    months.map((m) => [m, 0]),
  );
  for (const c of rows) {
    if (!c.date) continue;
    const key = monthKey(c.date);
    if (!(key in viewsByMonth)) continue;
    const views = c.performances?.[0]?.views ?? 0;
    viewsByMonth[key] += views;
  }
  const viewsData: BarPoint[] = months.map((m) => ({
    label: monthLabel(m),
    value: viewsByMonth[m] ?? 0,
  }));

  // Vidéos publiées par mois ----------------------------------------
  const publishedByMonth: Record<string, number> = Object.fromEntries(
    months.map((m) => [m, 0]),
  );
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

  // Top vidéo --------------------------------------------------------
  const withViews = rows
    .map((c) => ({
      id: c.id,
      title: c.title,
      views: c.performances?.[0]?.views ?? 0,
    }))
    .filter((c) => c.views > 0)
    .sort((a, b) => b.views - a.views);
  const topVideo = withViews[0] ?? null;

  // Top plateforme ---------------------------------------------------
  const platformViews: Record<string, number> = {};
  for (const c of rows) {
    const v = c.performances?.[0]?.views ?? 0;
    if (!c.platform) continue;
    platformViews[c.platform] = (platformViews[c.platform] ?? 0) + v;
  }
  const topPlatform = Object.entries(platformViews).sort((a, b) => b[1] - a[1])[0];

  // Top pilier -------------------------------------------------------
  const pillarViews: Record<string, number> = {};
  for (const c of rows) {
    const v = c.performances?.[0]?.views ?? 0;
    if (!c.pillar) continue;
    pillarViews[c.pillar] = (pillarViews[c.pillar] ?? 0) + v;
  }
  const topPillar = Object.entries(pillarViews).sort((a, b) => b[1] - a[1])[0];

  const totalViews = rows.reduce(
    (sum, c) => sum + (c.performances?.[0]?.views ?? 0),
    0,
  );
  const totalPublished = rows.filter((c) => c.status === "published").length;

  const hasAnyPerf = totalViews > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted">
          {active.name} · ce que tu mesures, tu peux l&apos;améliorer.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          icon={<BarChart3 className="size-4" />}
          label="Total vues"
          value={fmtNum(totalViews)}
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Vidéos publiées"
          value={String(totalPublished)}
        />
        <KpiCard
          icon={<Sparkles className="size-4" />}
          label="Vidéos avec stats"
          value={String(withViews.length)}
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
                Tu peux le faire à tout moment.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vues par mois</CardTitle>
            <CardDescription>Cumul sur les 6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={viewsData}
              color="var(--color-reel)"
              format="compact"
            />
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

      {/* Top performers */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-amber-500" />
              Vidéo la plus performante
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topVideo ? (
              <Link
                href={`/content/${topVideo.id}`}
                className="block hover:underline"
              >
                <div className="text-base font-semibold leading-snug">
                  {topVideo.title || "Sans titre"}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {fmtNum(topVideo.views)} vues
                </div>
              </Link>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="size-4 text-cyan-500" />
              Plateforme top
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPlatform ? (
              <>
                <div className="text-base font-semibold">
                  {platformLabel(topPlatform[0])}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {fmtNum(topPlatform[1])} vues cumulées
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="size-4 text-emerald-500" />
              Pilier gagnant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPillar ? (
              <>
                <div className="text-base font-semibold capitalize">
                  {topPillar[0]}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {fmtNum(topPillar[1])} vues cumulées
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
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
