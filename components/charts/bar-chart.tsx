"use client";

import { cn } from "@/lib/utils";

export type BarPoint = {
  label: string;
  value: number;
};

export function BarChart({
  data,
  color = "var(--color-primary)",
  formatValue = (v) => String(v),
  height = 180,
  className,
}: {
  data: BarPoint[];
  color?: string;
  formatValue?: (v: number) => string;
  height?: number;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const yTicks = [0, Math.round(max / 2), max];

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 p-6 text-sm text-muted",
          className,
        )}
        style={{ height }}
      >
        Pas encore de données.
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="flex">
        {/* Y-axis ticks */}
        <div
          className="flex shrink-0 flex-col-reverse justify-between pr-2 text-right text-[10px] text-muted"
          style={{ height }}
        >
          {yTicks.map((t) => (
            <span key={t}>{formatValue(t)}</span>
          ))}
        </div>

        {/* Bars area */}
        <div
          className="relative flex flex-1 items-end gap-1 border-l border-b border-border pl-2"
          style={{ height }}
        >
          {/* Grid lines */}
          <div
            className="pointer-events-none absolute inset-0 ml-2 flex flex-col-reverse justify-between"
            style={{ paddingBottom: 0 }}
          >
            {yTicks.map((t) => (
              <div
                key={t}
                className="h-px w-full border-t border-dashed border-border/60"
              />
            ))}
          </div>

          {data.map((d, i) => {
            const pct = (d.value / max) * 100;
            return (
              <div
                key={i}
                className="group relative flex flex-1 flex-col items-center justify-end"
                style={{ height }}
                title={`${d.label} · ${formatValue(d.value)}`}
              >
                <div
                  className="w-full max-w-12 rounded-t transition-all"
                  style={{
                    height: `${pct}%`,
                    background: color,
                    minHeight: d.value > 0 ? 2 : 0,
                  }}
                />
                {/* Tooltip on hover */}
                <div className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded bg-foreground px-2 py-0.5 text-[10px] font-medium text-background opacity-0 group-hover:opacity-100">
                  {formatValue(d.value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-8 mt-1 flex gap-1 pl-2">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 truncate text-center text-[10px] text-muted"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
