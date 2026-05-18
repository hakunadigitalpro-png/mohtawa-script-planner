"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { setLocale } from "@/app/(app)/actions";
import {
  LOCALES,
  LOCALE_LABELS,
  type Locale,
} from "@/i18n/config";

/**
 * Locale switcher pour la navbar de la landing publique.
 *
 * Design différent du `LocaleSwitcherCompact` (sidebar) :
 *   - bouton "pill" avec libellé visible
 *   - popover qui descend (la landing scroll, pas besoin de monter)
 *   - assez petit pour rester discret à côté du CTA principal
 */
export function LandingLocaleSwitcher() {
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
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 text-xs font-semibold text-foreground transition hover:border-foreground/30 hover:bg-card",
          open && "border-foreground/30 bg-card",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="size-3.5" />
        <span>{locale.toUpperCase()}</span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute end-0 top-full mt-2 z-50 min-w-[160px] overflow-hidden rounded-2xl border border-border/60 bg-card py-1 shadow-[0_12px_40px_-10px_rgba(10,6,18,0.18)]"
        >
          {LOCALES.map((loc) => {
            const active = loc === locale;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => onPick(loc)}
                disabled={pending}
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-secondary font-semibold"
                    : "hover:bg-secondary/70",
                )}
              >
                <span>{LOCALE_LABELS[loc]}</span>
                {active && <Check className="size-3.5 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
