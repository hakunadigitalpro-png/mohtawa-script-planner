"use client";

import { Camera, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { checkLighting, isLightSource } from "@/lib/filming-rules";
import type {
  EquipmentPlacement,
  EquipmentPosition,
  PresetEquipmentLayout,
} from "@/lib/types";

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
  label,
  onChangePlacement,
  onChangeCamera,
}: {
  items: EquipmentPlacement[];
  cameraPosition?: EquipmentPosition;
  /** Nom du setup/lieu (0051) — un storyboard peut mélanger plusieurs lieux
   *  avec un matériel différent, ce titre dit CLAIREMENT pour lequel c'est. */
  label?: string;
  onChangePlacement?: (
    equipmentLabel: string,
    position: EquipmentPosition,
  ) => void;
  onChangeCamera?: (position: EquipmentPosition) => void;
}) {
  const g = useTranslations("filmingGuide");
  if (items.length === 0 && !cameraPosition) return null;

  const cameraAngle = cameraPosition ? ANGLES[cameraPosition] : null;
  // Vérification en code, pas une consigne de prompt : une lumière derrière
  // toi = contre-jour = visage sombre. On le dit au lieu de laisser passer.
  const lightingIssue = checkLighting(items);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
          {g("equipmentLayoutTitle")}
        </span>
        {label && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent" dir="auto">
            {label}
          </span>
        )}
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

        {items.map((it, i) => {
          const isLight = isLightSource(it.label);
          const flagged = Boolean(
            lightingIssue && lightingIssue.lights.includes(it.label),
          );
          return (
            <Marker key={i} angleDeg={ANGLES[it.position] ?? 0}>
              <span
                className={
                  "size-3.5 shrink-0 rounded-full border-2 " +
                  (flagged
                    ? "border-destructive bg-destructive/20"
                    : isLight
                      ? "border-amber-400 bg-amber-100"
                      : "border-accent bg-secondary")
                }
              />
              <span
                className={
                  "max-w-20 text-center text-[10px] font-semibold leading-tight " +
                  (flagged ? "text-destructive" : "text-foreground")
                }
                dir="auto"
              >
                {it.label}
              </span>
            </Marker>
          );
        })}
      </div>

      {lightingIssue && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <p className="text-xs leading-relaxed text-destructive">
            {g("lightingWarning", { lights: lightingIssue.lights.join(", ") })}
          </p>
        </div>
      )}

      {(cameraAngle !== null || items.length > 0) && (
        <ul className="mt-3 space-y-2 border-t border-border/50 pt-2">
          {cameraAngle !== null && (
            <li className="flex items-start justify-between gap-2 text-xs text-muted">
              <span className="font-semibold text-foreground">{g("camera")}</span>
              {onChangeCamera && cameraPosition && (
                <PositionSelect
                  value={cameraPosition}
                  onChange={onChangeCamera}
                  ariaLabel={g("camera")}
                />
              )}
            </li>
          )}
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-2 text-xs text-muted"
            >
              <span dir="auto">
                <span className="font-semibold text-foreground">{it.label}</span>
                {it.note ? ` — ${it.note}` : ""}
              </span>
              {onChangePlacement && (
                <PositionSelect
                  value={it.position}
                  onChange={(p) => onChangePlacement(it.label, p)}
                  ariaLabel={it.label}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Corriger à la main une position proposée par l'IA. `<select>` natif ici
 * (et pas le Select custom de l'app) : il y a un de ces sélecteurs par
 * équipement, on veut le contrôle le plus compact et le plus léger possible
 * dans une liste dense.
 */
function PositionSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: EquipmentPosition;
  onChange: (p: EquipmentPosition) => void;
  ariaLabel: string;
}) {
  const g = useTranslations("filmingGuide.positions");
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as EquipmentPosition)}
      aria-label={ariaLabel}
      className="shrink-0 rounded-lg border border-border bg-card px-1.5 py-0.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {(Object.keys(ANGLES) as EquipmentPosition[]).map((p) => (
        <option key={p} value={p}>
          {g(p)}
        </option>
      ))}
    </select>
  );
}

/**
 * Un schéma PAR setup utilisé dans le storyboard (0051) — le matériel vit
 * sur chaque lieu, pas sur la marque, donc pas de schéma global unique.
 * Sans setup équipé, retombe sur un seul schéma "caméra seule" (si une
 * position caméra existe) — jamais rien montré silencieusement là où il y
 * avait un contenu à voir.
 */
export function FilmingLayouts({
  presetLayouts,
  cameraPosition,
  onChangePlacement,
  onChangeCamera,
}: {
  presetLayouts?: PresetEquipmentLayout[];
  cameraPosition?: EquipmentPosition;
  /** Fourni là où le guide est éditable (onglet Storyboard) — absent dans
   *  les aperçus de génération, qui sont en lecture seule avant application. */
  onChangePlacement?: (
    presetLabel: string,
    equipmentLabel: string,
    position: EquipmentPosition,
  ) => void;
  onChangeCamera?: (position: EquipmentPosition) => void;
}) {
  if (presetLayouts && presetLayouts.length > 0) {
    return (
      <div className="space-y-3">
        {presetLayouts.map((pl) => (
          <EquipmentLayoutDiagram
            key={pl.preset_label}
            items={pl.equipment_layout}
            cameraPosition={cameraPosition}
            label={pl.preset_label}
            onChangePlacement={
              onChangePlacement
                ? (equipmentLabel, position) =>
                    onChangePlacement(pl.preset_label, equipmentLabel, position)
                : undefined
            }
            onChangeCamera={onChangeCamera}
          />
        ))}
      </div>
    );
  }
  return (
    <EquipmentLayoutDiagram
      items={[]}
      cameraPosition={cameraPosition}
      onChangeCamera={onChangeCamera}
    />
  );
}
