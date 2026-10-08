"use client";

import { useSyncExternalStore } from "react";
import { Compass, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  coachModeSnapshot,
  seedCoachMode,
  setCoachMode,
  subscribeCoachMode,
  type CoachMode,
} from "@/lib/coach-pref";
import { forgetAllSeen } from "@/lib/krea-tours";

/**
 * « Krea te guide » : l'interrupteur des visites guidées.
 *
 * Le seul endroit pour les REMETTRE — les couper se fait aussi d'un lien
 * dans chaque bulle. Même forme que l'interrupteur d'écriture assistée de
 * la page de marque : un réglage qui se lit en une ligne.
 *
 * Le texte ne parle pas de Krea « en bas à droite » : le client invité a
 * cette carte aussi, et lui n'a pas Krea.
 */
export function CoachSwitch({ initialMode }: { initialMode: CoachMode }) {
  seedCoachMode(initialMode);
  const mode = useSyncExternalStore(
    subscribeCoachMode,
    coachModeSnapshot,
    () => initialMode,
  );
  const on = mode === "on";

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Compass className={cn("size-4", on ? "text-accent" : "text-muted")} />
            Krea te guide
          </h2>
          <p className="max-w-prose text-sm text-muted">
            {on
              ? "À la première ouverture de chaque page, Krea te montre où cliquer, étape par étape."
              : "Les visites guidées sont coupées. Tu peux les remettre ici."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Visites guidées de Krea"
          onClick={() => setCoachMode(on ? "off" : "on")}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
            on ? "bg-accent" : "bg-border",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-white shadow transition-transform",
              on ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {/* Pour une démo sur sa propre machine : tout revoir, page par page,
          comme au premier jour. */}
      {on && (
        <button
          type="button"
          onClick={forgetAllSeen}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <RotateCcw className="size-4" />
          Rejouer toutes les visites
        </button>
      )}
    </Card>
  );
}
