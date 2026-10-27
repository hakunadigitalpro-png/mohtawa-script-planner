"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

/**
 * Sélecteur « plage de dates » type Notion/Airtable : un seul popover
 * ouvre un calendrier où l'on clique le début puis la fin ; la plage
 * est surlignée en bleu entre les deux. Un interrupteur « Date de
 * fin » en bas désactive la seconde date (une campagne d'un jour).
 *
 * Deux inputs au trigger pour voir les deux dates d'un coup d'œil.
 * `onChange` est appelé à chaque sélection — début, fin, bascule du
 * toggle — l'écran parent sauvegarde comme bon lui semble.
 */
function safeParse(d: string | null): Date | null {
  if (!d) return null;
  try {
    const p = parseISO(d);
    if (Number.isNaN(p.getTime())) return null;
    return p;
  } catch {
    return null;
  }
}

const DMY = (d: Date) => format(d, "dd/MM/yyyy");

export function DateRangePicker({
  start,
  end,
  onChange,
  disabled = false,
  placeholder = "Choisir une date",
}: {
  start: string | null;
  end: string | null;
  onChange: (next: { start: string | null; end: string | null }) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const startD = safeParse(start);
  const endD = safeParse(end);

  const displayStart = startD ? DMY(startD) : placeholder;
  const displayEnd = endD ? DMY(endD) : "— / — / —";

  return (
    <Dropdown align="start" className="block w-full">
      <DropdownTrigger
        className={cn(
          "inline-flex h-11 w-full items-center gap-2 rounded-full border border-input bg-card px-4 text-sm transition",
          "hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <CalendarIcon className="size-4 shrink-0 text-muted" />
        <span
          className={cn(
            "truncate font-medium",
            startD ? "text-foreground" : "text-foreground/50",
          )}
        >
          {displayStart}
        </span>
        <span className="text-muted">→</span>
        <span
          className={cn(
            "truncate font-medium",
            endD ? "text-foreground" : "text-foreground/50",
          )}
        >
          {displayEnd}
        </span>
      </DropdownTrigger>
      <DropdownContent className="min-w-0 overflow-visible p-0">
        <Panel
          start={start}
          end={end}
          onChange={onChange}
        />
      </DropdownContent>
    </Dropdown>
  );
}

function Panel({
  start,
  end,
  onChange,
}: {
  start: string | null;
  end: string | null;
  onChange: (next: { start: string | null; end: string | null }) => void;
}) {
  const startD = safeParse(start);
  const endD = safeParse(end);

  // Toggle Date de fin : ON = plage (deux dates), OFF = jour unique.
  // Suit l'état fourni : si une date de fin est posée, on reste en plage.
  const [hasEnd, setHasEnd] = React.useState<boolean>(Boolean(endD));
  React.useEffect(() => {
    if (endD) setHasEnd(true);
  }, [endD]);

  const [cursor, setCursor] = React.useState<Date>(startD ?? new Date());
  const [hover, setHover] = React.useState<Date | null>(null);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const pick = (d: Date) => {
    const iso = format(d, "yyyy-MM-dd");
    // Jour unique (toggle OFF) : on remplace la date, pas de fin.
    if (!hasEnd) {
      onChange({ start: iso, end: null });
      return;
    }
    // Plage : si pas de début OU si on repart (début défini + fin
    // définie), on commence une nouvelle plage. Si début défini sans
    // fin et nouvelle date après : on pose la fin. Si avant : on
    // ré-aligne (nouvelle date = début, ancienne = fin).
    if (!startD || (startD && endD)) {
      onChange({ start: iso, end: null });
      return;
    }
    if (d < startD) {
      onChange({ start: iso, end: start });
    } else if (isSameDay(d, startD)) {
      // Clic sur le même jour que le début : plage d'un jour.
      onChange({ start: iso, end: iso });
    } else {
      onChange({ start: start, end: iso });
    }
  };

  const toggleEnd = (next: boolean) => {
    setHasEnd(next);
    if (!next && end) onChange({ start, end: null });
  };

  // Pour l'aperçu de la plage à la souris : si début posé sans fin, on
  // surligne jusqu'au jour survolé.
  const previewEnd = startD && !endD && hover && hover > startD ? hover : endD;

  const inRange = (d: Date): boolean => {
    if (!startD) return false;
    if (!previewEnd) return false;
    return d > startD && d < previewEnd;
  };

  return (
    <div className="w-[280px] p-3">
      {/* Deux inputs lecture-seule reflétant l'état posé — comme sur Notion. */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className={cn(
            "flex-1 rounded-md border px-2 py-1 text-xs text-center",
            startD ? "border-accent/50 bg-accent/5" : "border-border bg-card",
          )}
        >
          {startD ? DMY(startD) : "jj/mm/aaaa"}
        </div>
        {hasEnd && (
          <div
            className={cn(
              "flex-1 rounded-md border px-2 py-1 text-xs text-center",
              endD ? "border-accent/50 bg-accent/5" : "border-border bg-card",
            )}
          >
            {endD ? DMY(endD) : "jj/mm/aaaa"}
          </div>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold capitalize">
          {format(cursor, "MMM yyyy", { locale: fr })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              setCursor(t);
              pick(t);
            }}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-muted hover:bg-secondary"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-secondary"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-secondary"
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-muted">
        {["lu", "ma", "me", "je", "ve", "sa", "di"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = isSameMonth(d, cursor);
          const isStart = startD && isSameDay(d, startD);
          const isEnd = endD && isSameDay(d, endD);
          const isToday = isSameDay(d, new Date());
          const between = inRange(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => pick(d)}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                "flex h-8 w-full items-center justify-center text-sm transition",
                // Les cases de la plage prennent un fond bleu continu ;
                // le début et la fin un cercle plein plus foncé.
                between && "bg-accent/15 text-foreground",
                !between && !isStart && !isEnd && "rounded-full",
                isStart && (hasEnd && endD ? "rounded-l-full" : "rounded-full"),
                isEnd && "rounded-r-full",
                !inMonth && "text-foreground/30",
                inMonth && !between && !isStart && !isEnd &&
                  "text-foreground hover:bg-secondary",
                (isStart || isEnd) && "bg-accent font-semibold text-white",
                isToday && !between && !isStart && !isEnd &&
                  "font-semibold text-accent",
              )}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={hasEnd}
            onChange={(e) => toggleEnd(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative inline-block h-4 w-7 rounded-full bg-foreground/20 transition-colors peer-checked:bg-accent">
            <span
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                hasEnd ? "left-3.5" : "left-0.5",
              )}
            />
          </span>
          Date de fin
        </label>
        {(start || end) && (
          <button
            type="button"
            onClick={() => onChange({ start: null, end: null })}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-muted hover:text-foreground"
          >
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}
