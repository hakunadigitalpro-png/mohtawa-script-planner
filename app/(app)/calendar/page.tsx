import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { CalendarMonth } from "@/components/calendar-month";
import { NewContentButton } from "@/components/new-content-modal";
import type { Content } from "@/lib/types";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { active } = await resolveActiveBrand();
  if (!active) return null;

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
          <p className="text-sm text-muted">
            Visualise ton mois en un coup d&apos;œil.
          </p>
        </div>
        <NewContentButton />
      </div>

      <CalendarMonth initialMonth={monthStart} contents={contents} />
    </div>
  );
}
