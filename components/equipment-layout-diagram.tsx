"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EquipmentPlacement, EquipmentPosition } from "@/lib/types";

/**
 * Schéma vu du dessus : où placer le téléphone/caméra et chaque équipement
 * autour de la personne qui filme. Positions calculées en % pur CSS (même
 * approche que les autres charts de l'appli — pas de lib de graph, pas de
 * SVG). Les traits reliant le centre à chaque repère utilisent la même
 * trigonométrie que le placement des points, juste avec un ajustement de
 * -90° : rotate() part de l'axe horizontal (3h), nos angles partent du haut
 * (12h = "face").
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

function Spoke({ angleDeg }: { angleDeg: number }) {
  return (
    <div
      className="absolute h-px bg-border"
      style={{
        top: "50%",
        left: "50%",
        width: `${RADIUS_PCT}%`,
        transformOrigin: "0 0",
        transform: `rotate(${angleDeg - 90}deg)`,
      }}
    />
  );
}

function Marker({
  angleDeg,
  children,
}: {
  angleDeg: number;
  children: React.ReactNode;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const left = 50 + RADIUS_PCT * Math.sin(rad);
  const top = 50 - RADIUS_PCT * Math.cos(rad);
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ top: `${top}%`, left: `${left}%` }}
    >
      {children}
    </div>
  );
}

export function EquipmentLayoutDiagram({
  items,
  cameraPosition,
}: {
  items: EquipmentPlacement[];
  cameraPosition?: EquipmentPosition;
}) {
  const g = useTranslations("filmingGuide");
  if (items.length === 0 && !cameraPosition) return null;

  const cameraAngle = cameraPosition ? ANGLES[cameraPosition] : null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-accent">
        {g("equipmentLayoutTitle")}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-64">
        <div className="absolute inset-[6%] rounded-full border border-dashed border-border" />

        {cameraAngle !== null && <Spoke angleDeg={cameraAngle} />}
        {items.map((it, i) => (
          <Spoke key={i} angleDeg={ANGLES[it.position] ?? 0} />
        ))}

        <div
          className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground"
          style={{ top: "50%", left: "50%" }}
        >
          {g("equipmentLayoutSelf")}
        </div>

        {cameraAngle !== null && (
          <Marker angleDeg={cameraAngle}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-white">
              <Camera className="size-3.5" />
            </span>
            <span className="max-w-20 text-center text-[10px] font-semibold leading-tight text-foreground">
              {g("camera")}
            </span>
          </Marker>
        )}

        {items.map((it, i) => (
          <Marker key={i} angleDeg={ANGLES[it.position] ?? 0}>
            <span className="size-3.5 shrink-0 rounded-full border-2 border-accent bg-secondary" />
            <span
              className="max-w-20 text-center text-[10px] font-semibold leading-tight text-foreground"
              dir="auto"
            >
              {it.label}
            </span>
          </Marker>
        ))}
      </div>

      {(cameraAngle !== null || items.length > 0) && (
        <ul className="mt-3 space-y-1 border-t border-border/50 pt-2">
          {cameraAngle !== null && (
            <li className="text-xs text-muted">
              <span className="font-semibold text-foreground">{g("camera")}</span>
            </li>
          )}
          {items.map((it, i) => (
            <li key={i} className="text-xs text-muted" dir="auto">
              <span className="font-semibold text-foreground">{it.label}</span>
              {it.note ? ` — ${it.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
