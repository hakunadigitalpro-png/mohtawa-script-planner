"use client";

import { useMemo, useState } from "react";
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
import type { Content } from "@/lib/types";

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
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-secondary text-xs font-medium text-muted">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const otherMonth = !isSameMonth(d, cursor);
            const today = isSameDay(d, new Date());
            return (
              <div
                key={i}
                className={cn(
                  "group relative min-h-28 border-b border-r border-border p-1.5",
                  otherMonth && "bg-secondary/50",
                  (i + 1) % 7 === 0 && "border-r-0",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs",
                      today && "bg-primary text-primary-foreground font-semibold",
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
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Ajouter une vidéo ce jour"
                  >
                    <Plus className="size-4 text-muted hover:text-foreground" />
                  </button>
                </div>
                <ul className="mt-1 space-y-1">
                  {items.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/content/${c.id}`}
                        className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs hover:bg-accent"
                      >
                        <ColorDot color={typeColor(c.type)} />
                        <span className="truncate">{c.title || "Sans titre"}</span>
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && (
                    <li className="px-1 text-xs text-muted">+{items.length - 3}</li>
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
