"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setLocale } from "@/app/(app)/actions";
import {
  LOCALES,
  LOCALE_LABELS,
  type Locale,
} from "@/i18n/config";

/**
 * Petit globe (compact) pour la sidebar : ouvre un mini popover qui
 * liste les langues disponibles avec le check sur la sélection actuelle.
 */
export function LocaleSwitcherCompact() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onPick = (next: Locale) => {
    if (next === locale) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setLocale(next);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-label="Langue"
        className={cn(
          "tooltip-trigger flex size-11 items-center justify-center rounded-full bg-card/80 text-muted-foreground transition hover:bg-card hover:text-foreground",
          open && "bg-card text-foreground",
        )}
      >
        <Globe className="size-4" />
        <span className="tooltip-content">
          {LOCALE_LABELS[locale]}
        </span>
      </button>

      {open && (
        <div
          className="absolute bottom-0 start-full ms-2 z-40 min-w-[160px] overflow-hidden rounded-2xl border border-border/60 bg-card py-1 shadow-[0_12px_40px_-10px_rgba(10,6,18,0.18)]"
        >
          {LOCALES.map((loc) => {
            const active = loc === locale;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => onPick(loc)}
                disabled={pending}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-secondary font-semibold"
                    : "hover:bg-secondary/70",
                )}
              >
                <span>{LOCALE_LABELS[loc]}</span>
                {active && <Check className="size-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Version "complète" pour /profile : 2 cartes côte à côte.
 */
export function LocaleSwitcherFull() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onPick = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {LOCALES.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => onPick(loc)}
            disabled={pending}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-3 text-start transition",
              active
                ? "border-accent bg-accent/5"
                : "border-border bg-card hover:border-foreground/30",
            )}
          >
            <div>
              <div className="text-sm font-semibold">{LOCALE_LABELS[loc]}</div>
              <div className="text-xs uppercase tracking-wider text-muted">
                {loc}
              </div>
            </div>
            {active && (
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Check className="size-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
