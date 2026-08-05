import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import { ContentCard } from "@/components/content-card";
import { NewContentButton } from "@/components/new-content-modal";
import { DashboardFilters } from "@/components/dashboard-filters";
import type { Content } from "@/lib/types";

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  platform?: string;
  month?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { active } = await resolveActiveBrand();
  if (!active) return null;

  const t = await getTranslations("dashboard");
  const params = await searchParams;

  const supabase = await createClient();

  // Bascule en masse "programmed" → "live" (post/carrousel/infographie) dès
  // que leur date+heure de publication est dépassée — pas de tâche planifiée
  // dans cette app, donc on recalcule à chaque chargement de page (0041).
  await supabase.rpc("recompute_live_statuses", { p_brand_id: active.id });

  // KPIs : on calcule sur la totalité de la marque (pas filtré)
  const { data: allRows } = await supabase
    .from("contents")
    .select("status, date")
    .eq("brand_id", active.id);

  const allContents = allRows ?? [];
  const total = allContents.length;
  // "published" (vidéos) et "live" (post/carrousel/infographie, migration
  // 0041) sont les deux équivalents "c'est sorti" selon le type de contenu.
  const isOut = (status: string) => status === "published" || status === "live";
  const drafts = allContents.filter((c) => !isOut(c.status)).length;
  const published = allContents.filter((c) => isOut(c.status)).length;
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thisMonth = allContents.filter((c) => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return d >= startMonth && d < endMonth;
  }).length;

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">
            {t("subtitle", { brand: active.name })}
          </p>
        </div>
        <NewContentButton />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label={t("kpi.total")} value={total} accent />
        <Kpi label={t("kpi.drafts")} value={drafts} />
        <Kpi label={t("kpi.published")} value={published} />
        <Kpi label={t("kpi.thisMonth")} value={thisMonth} />
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
        (accent
          ? "border-0 bg-accent text-accent-foreground shadow-[0_10px_30px_-12px_rgba(255,107,53,0.45)]"
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
