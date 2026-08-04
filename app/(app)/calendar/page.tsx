import Link from "next/link";
import {
  CalendarDays,
  LayoutList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { CalendarMonth } from "@/components/calendar-month";
import { CalendarQuickCreate } from "@/components/calendar-quick-create";
import { PlanningTable } from "@/components/planning-table";
import type { Content } from "@/lib/types";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; view?: string }>;
}) {
  const { active } = await resolveActiveBrand();
  if (!active) return null;

  const t = await getTranslations("calendar");
  const params = await searchParams;
  const now = new Date();
  const ym =
    params.m && /^\d{4}-\d{2}$/.test(params.m)
      ? params.m
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const view = params.view === "planning" ? "planning" : "calendar";

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
  const { data } = await supabase
    .from("contents")
    .select("*")
    .eq("brand_id", active.id)
    .gte("date", monthStart)
    .lt("date", monthEnd);

  const contents = (data ?? []) as Content[];

  const tabCls = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
      on
        ? "bg-accent text-accent-foreground"
        : "text-muted hover:text-foreground",
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-card p-0.5">
            <Link href={`?m=${ym}&view=calendar`} className={tabCls(view === "calendar")}>
              <CalendarDays className="size-4" />
              Calendrier
            </Link>
            <Link href={`?m=${ym}&view=planning`} className={tabCls(view === "planning")}>
              <LayoutList className="size-4" />
              Planning
            </Link>
          </div>
          <CalendarQuickCreate />
        </div>
      </div>

      {view === "planning" ? (
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
          <PlanningTable contents={contents} />
        </div>
      ) : (
        <CalendarMonth initialMonth={monthStart} contents={contents} />
      )}
    </div>
  );
}
