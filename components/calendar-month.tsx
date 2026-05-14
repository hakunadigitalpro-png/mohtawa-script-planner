"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ColorDot } from "@/components/ui/badge";
import { typeColor } from "@/lib/constants";
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
          <Button variant="outline" size="icon" onClick={() => goto(addMonths(cursor, -1))} aria-label="Mois précédent">
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="min-w-44 text-center text-lg font-semibold capitalize">
            {format(cursor, "MMMM yyyy", { locale: fr })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => goto(addMonths(cursor, 1))} aria-label="Mois suivant">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => goto(new Date())}>
            Aujourd&apos;hui
          </Button>
        </div>
        <p className="hidden text-xs text-muted md:block">
          💡 Glisse une vidéo d&apos;un jour à l&apos;autre pour la replanifier.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_2px_12px_-4px_rgba(26,15,37,0.06)]">
        <div className="grid grid-cols-7 border-b border-border/60 bg-secondary/50 text-[11px] font-bold uppercase tracking-wider text-muted">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} className="px-2 py-2.5 text-center">{d}</div>
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
                  "group relative min-h-28 border-b border-r border-border/60 p-2 transition-all",
                  otherMonth && "bg-secondary/30",
                  (i + 1) % 7 === 0 && "border-r-0",
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
                    aria-label="Ajouter une vidéo ce jour"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <ul className="mt-1.5 space-y-1">
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
                        className="flex cursor-grab items-center gap-1.5 truncate rounded-full bg-secondary/50 px-2 py-1 text-[11px] font-medium hover:bg-secondary active:cursor-grabbing"
                      >
                        <ColorDot color={typeColor(c.type)} />
                        <span className="truncate">{c.title || "Sans titre"}</span>
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && (
                    <li className="px-2 text-[11px] font-medium text-muted">
                      +{items.length - 3} autres
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
