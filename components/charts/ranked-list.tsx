"use client";

import { cn } from "@/lib/utils";

export type RankedItem = {
  key: string;
  label: string;
  value: number;
  secondary?: string;
};

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function RankedList({
  items,
  color = "var(--color-primary)",
  emptyLabel = "Pas de données.",
  format = "compact",
  className,
}: {
  items: RankedItem[];
  color?: string;
  emptyLabel?: string;
  format?: "compact" | "number";
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary/30 p-4 text-center text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((i) => i.value), 1);

  return (
    <ul className={cn("space-y-2", className)}>
      {sorted.map((item, idx) => {
        const pct = (item.value / max) * 100;
        const isTop = idx === 0 && item.value > 0;
        return (
          <li key={item.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "truncate",
                    isTop ? "font-semibold" : "font-medium",
                  )}
                >
                  {item.label}
                </span>
                {item.secondary && (
                  <span className="ml-2 text-xs text-muted">{item.secondary}</span>
                )}
              </div>
              <span className={cn("shrink-0 tabular-nums", isTop ? "font-semibold" : "text-muted")}>
                {format === "compact" ? fmtCompact(item.value) : item.value}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(pct, item.value > 0 ? 4 : 0)}%`,
                  background: color,
                  opacity: isTop ? 1 : 0.55,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
