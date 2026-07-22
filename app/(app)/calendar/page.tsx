import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { CalendarMonth } from "@/components/calendar-month";
import { CalendarQuickCreate } from "@/components/calendar-quick-create";
import type { Content } from "@/lib/types";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { active } = await resolveActiveBrand();
  if (!active) return null;

  const t = await getTranslations("calendar");
  const params = await searchParams;
  const now = new Date();
  const ym = params.m && /^\d{4}-\d{2}$/.test(params.m)
    ? params.m
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthStart = `${ym}-01`;
  // End of month range (next month start) – use date-fns lite
  const [year, month] = ym.split("-").map(Number);
  const nextMonth = new Date(year, month, 1); // month is 1-based, JS Date is 0-based, so this is the next month
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contents")
    .select("*")
    .eq("brand_id", active.id)
    .gte("date", monthStart)
    .lt("date", monthEnd);

  const contents = (data ?? []) as Content[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <CalendarQuickCreate />
        <div className="min-w-0 flex-1">
          <CalendarMonth initialMonth={monthStart} contents={contents} />
        </div>
      </div>
    </div>
  );
}
