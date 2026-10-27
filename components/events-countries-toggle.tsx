"use client";

import * as React from "react";
import { Globe2 } from "lucide-react";
import {
  COUNTRY_LABELS,
  DEFAULT_COUNTRIES,
  type EventCountry,
} from "@/lib/maghreb-events";

type Country = Exclude<EventCountry, "ALL">;
const ALL_COUNTRIES: Country[] = ["TN", "MA", "DZ", "CA"];
const COOKIE = "kreatly_countries";

function readCookie(): Country[] {
  if (typeof document === "undefined") return DEFAULT_COUNTRIES;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  if (!m) return DEFAULT_COUNTRIES;
  const parts = decodeURIComponent(m[1]).split(",").filter(Boolean) as Country[];
  const kept = parts.filter((p) => ALL_COUNTRIES.includes(p));
  return kept.length ? kept : DEFAULT_COUNTRIES;
}

function writeCookie(cs: Country[]) {
  if (typeof document === "undefined") return;
  const value = cs.join(",");
  // 1 an, lu côté client (le re-render est fait à la main par refresh)
  document.cookie = `${COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

/**
 * Toggle multi-pays pour les marqueurs du calendrier Maghreb. Posé en
 * haut à droite de /calendar, à côté du bouton « Aujourd'hui ». Change
 * un cookie et rafraîchit la page : les pastilles rendues côté serveur
 * (dans CalendarMonth) relisent le cookie et affichent le bon jeu.
 */
export function EventsCountriesToggle() {
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState<Country[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setPicked(readCookie());
    setMounted(true);
  }, []);

  const toggle = (c: Country) => {
    const next = picked.includes(c)
      ? picked.filter((x) => x !== c)
      : [...picked, c];
    setPicked(next);
    writeCookie(next);
    // Rafraîchit la page pour que /calendar relise le cookie côté serveur.
    window.location.reload();
  };

  if (!mounted) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
        aria-label="Événements par pays"
      >
        <Globe2 className="size-4" />
        <span>{picked.length === 0 ? "Pays…" : picked.join(" · ")}</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 z-20 mt-2 w-48 rounded-2xl border border-border bg-card p-2 shadow-lg">
            <p className="px-2 py-1 text-xs text-muted">
              Afficher les événements de :
            </p>
            {ALL_COUNTRIES.map((c) => {
              const on = picked.includes(c);
              return (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(c)}
                    className="size-4 rounded border-border"
                  />
                  <span className="text-foreground">{COUNTRY_LABELS[c]}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
