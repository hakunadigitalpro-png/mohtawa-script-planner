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
import { Dropdown, DropdownTrigger, DropdownContent } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

/**
 * Un sélecteur date + heure sur mesure, bâti pour tenir dans les boutons
 * arrondis du reste du produit : plus de popup natif aux coins carrés.
 *
 * Le trigger est une pastille `rounded-full` ; la popup est un calendrier
 * compact (grille 7×6, flèches mois) à gauche et une colonne d'heures à
 * droite (défilable, 15 minutes de pas). Le jour sélectionné et l'heure
 * active prennent la couleur passée (`accentColor`) — on l'utilise pour
 * teinter chaque ligne par sa plateforme : Instagram, Facebook, LinkedIn…
 */
export function DateTimePicker({
  date,
  time,
  onChange,
  accentColor,
  placeholder = "Choisir une date",
  disabled = false,
  ariaLabel,
}: {
  /** YYYY-MM-DD, ou vide. */
  date: string;
  /** HH:MM, ou vide. */
  time: string;
  /** Appelé au moindre changement de date OU d'heure. */
  onChange: (next: { date: string; time: string }) => void;
  /** Couleur CSS (hex, var(--…)…) pour la pastille active et les hovers. */
  accentColor?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const accent = accentColor ?? "var(--color-accent, #FF6B35)";

  const parsed = date ? safeParse(date) : null;
  const displayDate = parsed
    ? format(parsed, "d MMM yyyy", { locale: fr })
    : placeholder;
  const displayTime = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : "";

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
            date ? "text-foreground" : "text-foreground/50",
          )}
        >
          {displayDate}
        </span>
        {displayTime && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold text-white"
            style={{ background: accent }}
          >
            {displayTime}
          </span>
        )}
      </DropdownTrigger>
      <DropdownContent className="min-w-0 overflow-visible p-0">
        <Panel
          date={date}
          time={time}
          accent={accent}
          onChange={onChange}
        />
      </DropdownContent>
    </Dropdown>
  );
}

function safeParse(d: string): Date | null {
  try {
    const p = parseISO(d);
    if (Number.isNaN(p.getTime())) return null;
    return p;
  } catch {
    return null;
  }
}

// Pas de 15 minutes de 06:00 à 23:00 — large plage utile sans défilement
// interminable. L'utilisatrice peut toujours cliquer « Autre » puis saisir
// à la main une heure hors de cette liste.
const TIME_SLOTS = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

function Panel({
  date,
  time,
  accent,
  onChange,
}: {
  date: string;
  time: string;
  accent: string;
  onChange: (next: { date: string; time: string }) => void;
}) {
  const selected = date ? safeParse(date) : null;
  const [cursor, setCursor] = React.useState<Date>(selected ?? new Date());
  const timeNormalized = time && time.length >= 5 ? time.slice(0, 5) : "";

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const pickDate = (d: Date) => {
    onChange({ date: format(d, "yyyy-MM-dd"), time });
  };
  const pickTime = (t: string) => {
    onChange({ date, time: t });
  };

  return (
    <div className="flex gap-3 p-3">
      <div className="w-[260px]">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-secondary"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold capitalize">
            {format(cursor, "MMMM yyyy", { locale: fr })}
          </span>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-secondary"
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-muted">
          {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((d) => {
            const inMonth = isSameMonth(d, cursor);
            const isSelected = selected && isSameDay(d, selected);
            const isToday = isSameDay(d, new Date());
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => pickDate(d)}
                className={cn(
                  "flex h-8 w-full items-center justify-center rounded-full text-sm transition",
                  !inMonth && "text-foreground/30",
                  inMonth && !isSelected && "text-foreground hover:bg-secondary",
                  isSelected && "font-semibold text-white",
                  isToday && !isSelected && "font-semibold text-foreground",
                )}
                style={isSelected ? { background: accent } : undefined}
              >
                {format(d, "d")}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => pickDate(new Date())}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary"
          >
            Aujourd&apos;hui
          </button>
          {date && (
            <button
              type="button"
              onClick={() => onChange({ date: "", time: "" })}
              className="rounded-full px-3 py-1 text-xs font-medium text-muted hover:text-foreground"
            >
              Effacer
            </button>
          )}
        </div>
      </div>
      <div className="w-[90px] border-l border-border/60 pl-3">
        <div className="mb-1 text-[11px] font-semibold uppercase text-muted">
          Heure
        </div>
        <div className="h-[260px] overflow-y-auto pr-1">
          {TIME_SLOTS.map((slot) => {
            const active = slot === timeNormalized;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => pickTime(slot)}
                className={cn(
                  "block w-full rounded-full px-2 py-1 text-sm transition",
                  active ? "font-semibold text-white" : "text-foreground hover:bg-secondary",
                )}
                style={active ? { background: accent } : undefined}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
