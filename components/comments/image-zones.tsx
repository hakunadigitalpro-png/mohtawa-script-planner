"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { normalizeAnchor, type Anchor } from "@/lib/anchor";

export type ImageZone = { key: string; letter: string; anchor: Anchor };

/**
 * Une vraie souris ? Au doigt, on ne donne pas le focus au champ de texte après
 * un dessin : le clavier recouvrirait la zone qu'on est en train de commenter.
 */
export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}

/** Sous cette taille, c'est un simple toucher : on pose une zone par défaut. */
const TAP = 0.02;
const DEFAULT_SIZE = 0.18;

/**
 * Une image sur laquelle on montre ce dont on parle : les zones déjà posées,
 * et de quoi en dessiner une nouvelle.
 *
 * À la souris on dessine directement. Au doigt, le même geste sert à faire
 * défiler la page : il faut donc d'abord demander à dessiner (`drawing`), sinon
 * un client sur téléphone ne pourrait plus descendre sous un visuel.
 *
 * Pas d'orange : un cadre sombre à liseré blanc reste lisible sur n'importe
 * quelle image, et l'orange reste à l'action principale de l'écran.
 */
export function ImageZones({
  zones,
  canDraw,
  drawing,
  onDraw,
  children,
}: {
  zones: ImageZone[];
  canDraw: boolean;
  drawing: boolean;
  onDraw?: (anchor: Anchor) => void;
  children: React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const [live, setLive] = React.useState<Anchor | null>(null);

  const at = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1),
      y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canDraw || (e.pointerType !== "mouse" && !drawing)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = at(e);
    setLive({ ...start.current, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const p = at(e);
    setLive({
      x: Math.min(start.current.x, p.x),
      y: Math.min(start.current.y, p.y),
      w: Math.abs(p.x - start.current.x),
      h: Math.abs(p.y - start.current.y),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const from = start.current;
    start.current = null;
    setLive(null);
    if (!from) return;
    const to = at(e);
    const w = Math.abs(to.x - from.x);
    const h = Math.abs(to.y - from.y);
    const tapped = w < TAP && h < TAP;
    // À la souris, un clic n'est pas une demande de zone : on regarde l'image.
    // Au doigt, on a demandé à dessiner : le toucher pose une zone par défaut.
    if (tapped && e.pointerType === "mouse") return;
    const anchor = normalizeAnchor(
      tapped
        ? {
            x: Math.max(from.x - DEFAULT_SIZE / 2, 0),
            y: Math.max(from.y - DEFAULT_SIZE / 2, 0),
            w: DEFAULT_SIZE,
            h: DEFAULT_SIZE,
          }
        : { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w, h },
    );
    if (anchor) onDraw?.(anchor);
  };

  return (
    <div
      ref={box}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        setLive(null);
      }}
      className={cn(
        "relative select-none",
        canDraw && "cursor-crosshair",
        canDraw && drawing && "touch-none",
      )}
    >
      {children}
      {zones.map((z) => (
        <ZoneBox key={z.key} anchor={z.anchor} letter={z.letter} />
      ))}
      {live && <ZoneBox anchor={live} />}
    </div>
  );
}

function ZoneBox({ anchor, letter }: { anchor: Anchor; letter?: string }) {
  return (
    // left/top restent physiques, même en arabe : l'image n'est pas retournée.
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-md border-2 border-white shadow-[0_0_0_2px_rgba(10,6,18,0.85)]"
      style={{
        left: `${anchor.x * 100}%`,
        top: `${anchor.y * 100}%`,
        width: `${anchor.w * 100}%`,
        height: `${anchor.h * 100}%`,
      }}
    >
      {letter && (
        // À l'intérieur du cadre : au bord de l'image, le conteneur la couperait.
        <span className="absolute left-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
          {letter}
        </span>
      )}
    </div>
  );
}
