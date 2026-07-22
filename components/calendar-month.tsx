"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { fr, ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ColorDot } from "@/components/ui/badge";
import { typeColor, statusColor, statusLabel } from "@/lib/constants";
import { NewContentModal } from "@/components/new-content-modal";
import { updateContent } from "@/app/(app)/contents/actions";
import type { Content } from "@/lib/types";

const DRAG_MIME = "application/x-mohtawa-content-id";

export function CalendarMonth({
  initialMonth,
  contents,
}: {
  initialMonth: string; // YYYY-MM-01
  contents: Content[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations("calendar");
  const tContent = useTranslations("content");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? ar : fr;
  const cursor = useMemo(() => parseISO(initialMonth), [initialMonth]);

  const [modalOpen, setModalOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | undefined>(undefined);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const goto = (newDate: Date) => {
    const params = new URLSearchParams(sp.toString());
    params.set("m", format(newDate, "yyyy-MM"));
    router.push(`/calendar?${params.toString()}`);
  };

  const byDay = useMemo(() => {
    const map = new Map<string, Content[]>();
    for (const c of contents) {
      if (!c.date) continue;
      const key = c.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [contents]);

  const onDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const id = e.dataTransfer.getData(DRAG_MIME);
    if (!id) return;
    // Optimistic feel: kick off the update and refresh
    startTransition(async () => {
      await updateContent(id, { date: targetDate });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goto(addMonths(cursor, -1))} aria-label={t("prevMonth")}>
            <ChevronLeft className="size-4 rtl-flip" />
          </Button>
          <h2 className="min-w-44 text-center text-lg font-semibold capitalize">
            {format(cursor, "MMMM yyyy", { locale: dateLocale })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => goto(addMonths(cursor, 1))} aria-label={t("nextMonth")}>
            <ChevronRight className="size-4 rtl-flip" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => goto(new Date())}>
            {t("today")}
          </Button>
        </div>
        <p className="hidden text-xs text-muted md:block">
          {t("dragHint")}
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_2px_12px_-4px_rgba(26,15,37,0.06)]">
        <div className="grid grid-cols-7 border-b border-border/60 bg-secondary/50 text-[11px] font-bold uppercase tracking-wider text-muted">
          {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((d) => (
            <div key={d} className="px-2 py-2.5 text-center">{t(`weekdays.${d}`)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const otherMonth = !isSameMonth(d, cursor);
            const today = isSameDay(d, new Date());
            const isDragOver = dragOverKey === key;
            return (
              <div
                key={i}
                className={cn(
                  "group relative min-h-32 border-b border-e border-border/60 p-2 transition-all",
                  otherMonth && "bg-secondary/30",
                  (i + 1) % 7 === 0 && "border-e-0",
                  isDragOver && "bg-accent/10 ring-2 ring-accent ring-inset",
                )}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(DRAG_MIME)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverKey !== key) setDragOverKey(key);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverKey === key) setDragOverKey(null);
                }}
                onDrop={(e) => onDrop(e, key)}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                      today && "bg-ink text-white",
                      !today && otherMonth && "text-muted",
                      !today && !otherMonth && "text-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPickedDate(key);
                      setModalOpen(true);
                    }}
                    className="flex size-6 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
                    aria-label={t("addOnDay")}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {items.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/content/${c.id}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData(DRAG_MIME, c.id);
                          e.dataTransfer.setData("text/plain", c.title ?? "");
                        }}
                        dir="auto"
                        style={{ borderInlineStartColor: typeColor(c.type) }}
                        className="block cursor-grab rounded-lg border-s-[3px] bg-secondary/40 p-2 transition-colors hover:bg-secondary active:cursor-grabbing"
                      >
                        {/* Nom */}
                        <div className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                          {c.title || tContent("untitled")}
                        </div>
                        {/* Pilier */}
                        {c.pillar && (
                          <div className="mt-1">
                            <span className="inline-block max-w-full truncate rounded-md bg-secondary px-1.5 py-0.5 align-middle text-xs font-medium text-foreground/70">
                              {c.pillar}
                            </span>
                          </div>
                        )}
                        {/* Statut */}
                        <div className="mt-1 flex items-center gap-1.5">
                          <ColorDot color={statusColor(c.status)} />
                          <span className="text-xs font-medium text-muted">
                            {statusLabel(c.status)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && (
                    <li className="px-1 text-xs font-medium text-muted">
                      {t("moreItems", { count: items.length - 3 })}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <NewContentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultDate={pickedDate}
      />
    </div>
  );
}
