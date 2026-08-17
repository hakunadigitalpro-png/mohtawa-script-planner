"use client";

import { useTranslations } from "next-intl";
import type { EquipmentPlacement, EquipmentPosition } from "@/lib/types";

/**
 * Schéma vu du dessus : où placer chaque équipement autour de la personne
 * qui filme. Positions calculées en % pur CSS (même approche que les autres
 * charts de l'appli — pas de lib de graph, pas de SVG).
 */
const ANGLES: Record<EquipmentPosition, number> = {
  face: 0,
  avant_droite: 45,
  droite: 90,
  arriere_droite: 135,
  arriere: 180,
  arriere_gauche: 225,
  gauche: 270,
  avant_gauche: 315,
};

const RADIUS_PCT = 38;

export function EquipmentLayoutDiagram({ items }: { items: EquipmentPlacement[] }) {
  const g = useTranslations("filmingGuide");
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-accent">
        {g("equipmentLayoutTitle")}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-64">
        <div className="absolute inset-[6%] rounded-full border border-dashed border-border" />

        <div
          className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground"
          style={{ top: "50%", left: "50%" }}
        >
          {g("equipmentLayoutSelf")}
        </div>

        {items.map((it, i) => {
          const angleDeg = ANGLES[it.position] ?? 0;
          const rad = (angleDeg * Math.PI) / 180;
          const left = 50 + RADIUS_PCT * Math.sin(rad);
          const top = 50 - RADIUS_PCT * Math.cos(rad);
          return (
            <div
              key={i}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              <span className="size-3.5 shrink-0 rounded-full border-2 border-accent bg-secondary" />
              <span
                className="max-w-20 text-center text-[10px] font-semibold leading-tight text-foreground"
                dir="auto"
              >
                {it.label}
              </span>
            </div>
          );
        })}
      </div>

      <ul className="mt-3 space-y-1 border-t border-border/50 pt-2">
        {items.map((it, i) => (
          <li key={i} className="text-xs text-muted" dir="auto">
            <span className="font-semibold text-foreground">{it.label}</span>
            {it.note ? ` — ${it.note}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
