import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import { ContentCard } from "@/components/content-card";
import { NewContentButton } from "@/components/new-content-modal";
import type { Content } from "@/lib/types";

export default async function DashboardPage() {
  const { active } = await resolveActiveBrand();
  if (!active) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    .select("*")
    .eq("brand_id", active.id)
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const contents = (data ?? []) as Content[];
  const total = contents.length;
  const drafts = contents.filter((c) => c.status !== "published").length;
  const published = contents.filter((c) => c.status === "published").length;

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thisMonth = contents.filter((c) => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return d >= startMonth && d < endMonth;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted">
            {active.name} · vue rapide de ton activité.
          </p>
        </div>
        <NewContentButton />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Total vidéos" value={total} />
        <Kpi label="Brouillons" value={drafts} />
        <Kpi label="Publiées" value={published} />
        <Kpi label="Ce mois-ci" value={thisMonth} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Vidéos récentes</h2>
        {contents.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <p className="text-base font-medium">Aucune vidéo pour le moment.</p>
            <p className="text-sm text-muted">Commence par créer ta première vidéo.</p>
            <div className="mt-2">
              <NewContentButton />
            </div>
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

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Card>
  );
}
