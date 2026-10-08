"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KreaBadge } from "@/components/krea-avatar";
import {
  coachModeSnapshot,
  seedCoachMode,
  setCoachMode,
  subscribeCoachMode,
  type CoachMode,
} from "@/lib/coach-pref";
import {
  isSeen,
  markSeen,
  requestsSnapshot,
  seenServerSnapshot,
  seenSnapshot,
  subscribeRequests,
  subscribeSeen,
  tourForPath,
  TOURS,
  type Tour,
  type TourStep,
} from "@/lib/krea-tours";
import type { BrandRole } from "@/lib/brand";

/**
 * La visite guidée de la page courante, en coach-marks.
 *
 * Chaque étape met en lumière un élément réel (repéré par `data-tour`) et
 * ancre une bulle à côté, le reste de l'écran assombri. Elle montre OÙ
 * cliquer, pas seulement du texte — c'est ce qui manquait aux bulles
 * d'accueil posées dans le coin.
 *
 * Montée une fois, dans le layout : c'est l'URL qui choisit la visite. Elle
 * s'ouvre toute seule à la première visite de chaque page, se rejoue depuis
 * le panneau de Krea, et se coupe pour de bon d'un lien dans la bulle.
 *
 * Une étape dont la cible n'existe pas (page vide, bouton masqué par le
 * rôle, autre vue du calendrier) est SAUTÉE : une bulle centrée qui décrit
 * un bouton invisible ferait l'inverse de ce qu'on veut. Et la visite
 * n'ouvre pas tant que la page n'a pas fini d'arriver — le layout, lui, est
 * déjà là pendant que la page charge derrière son squelette.
 */

/** Le voile : la même encre que la fenêtre maison (`bg-ink/30`), plus dense. */
const VEIL = "color-mix(in srgb, var(--color-ink) 60%, transparent)";

/** Combien de temps on laisse à la page pour afficher sa première cible. */
const WAIT_FOR_PAGE_MS = 8000;
const POLL_MS = 300;

function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null;
  return document.querySelector(`[data-tour="${step.target}"]`);
}

/** Les étapes jouables maintenant : celles sans cible, et celles dont la
 *  cible est bien à l'écran. */
function playableSteps(tour: Tour): TourStep[] {
  return tour.steps.filter((s) => !s.target || findTarget(s));
}

/** Une fenêtre ouverte, un champ en cours d'édition : on n'interrompt pas. */
function pageIsBusy(): boolean {
  if (document.querySelector('[role="dialog"]')) return true;
  const tag = document.activeElement?.tagName ?? "";
  return tag === "INPUT" || tag === "TEXTAREA";
}

export function CoachTour({
  mode,
  role,
  tourId,
}: {
  /** Lu en cookie côté serveur, pour amorcer l'état client. */
  mode: CoachMode;
  role: BrandRole | null;
  /** Force une visite précise au lieu de la déduire de l'URL (aperçu). */
  tourId?: string;
}) {
  seedCoachMode(mode);
  const pathname = usePathname();
  const tour = tourId
    ? (TOURS.find((t) => t.id === tourId) ?? null)
    : tourForPath(pathname, role === "viewer" ? "viewer" : "team");

  const seen = React.useSyncExternalStore(
    subscribeSeen,
    seenSnapshot,
    seenServerSnapshot,
  );
  const requests = React.useSyncExternalStore(
    subscribeRequests,
    requestsSnapshot,
    requestsSnapshot,
  );
  // Le même état que l'interrupteur du Profil : couper là-bas coupe ici,
  // sans rechargement.
  const coach = React.useSyncExternalStore(
    subscribeCoachMode,
    coachModeSnapshot,
    () => mode,
  );

  if (!tour) return null;
  // `key` sur la visite : changer de page remonte tout, l'étape repart à 0.
  return (
    <TourPlayer
      key={tour.id}
      tour={tour}
      autoOpen={coach === "on" && !isSeen(seen, tour.id)}
      requests={requests}
    />
  );
}

function TourPlayer({
  tour,
  autoOpen,
  requests,
}: {
  tour: Tour;
  autoOpen: boolean;
  requests: number;
}) {
  const [steps, setSteps] = React.useState<TourStep[]>([]);
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const bubbleRef = React.useRef<HTMLDivElement>(null);
  const lastRequest = React.useRef(requests);
  const open = steps.length > 0;

  const start = React.useCallback(() => {
    const playable = playableSteps(tour);
    // Rien d'ancré à montrer (page vide) : la visite n'a pas lieu d'être.
    if (!playable.some((s) => s.target)) return false;
    setStep(0);
    setSteps(playable);
    return true;
  }, [tour]);

  // Première visite de la page : on attend que sa première cible soit là
  // (la page arrive après le layout), puis on ouvre — sauf si quelque chose
  // d'autre est déjà à l'écran à ce moment-là.
  React.useEffect(() => {
    if (!autoOpen) return;
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += POLL_MS;
      const ready = tour.steps.some((s) => s.target && findTarget(s));
      if (ready) {
        window.clearInterval(timer);
        if (!pageIsBusy()) start();
      } else if (elapsed >= WAIT_FOR_PAGE_MS) {
        window.clearInterval(timer);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [autoOpen, tour, start]);

  // « Fais-moi visiter cette page » : une demande explicite ouvre toujours,
  // visites coupées ou non — sans changer la préférence.
  React.useEffect(() => {
    if (requests === lastRequest.current) return;
    lastRequest.current = requests;
    start();
  }, [requests, start]);

  const finish = React.useCallback(() => {
    markSeen(tour.id);
    setSteps([]);
    setStep(0);
    setPos(null);
    setRect(null);
  }, [tour.id]);

  const [confirmingOff, setConfirmingOff] = React.useState(false);
  const disable = () => {
    setCoachMode("off");
    setConfirmingOff(false);
    finish();
  };

  // Localise la cible de l'étape, et la suit au défilement. Échap ferme.
  React.useEffect(() => {
    if (!open) return;
    const current = steps[step];
    const measure = () => {
      const el = findTarget(current);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const el = findTarget(current);
    // Une cible qui dépasse l'écran se cale en haut, sinon « center » la
    // laisse coupée des deux côtés.
    el?.scrollIntoView({
      behavior: "smooth",
      block:
        el.getBoundingClientRect().height > window.innerHeight * 0.6
          ? "start"
          : "center",
    });
    measure();
    const t = window.setTimeout(measure, 400);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, step, steps, finish]);

  // La bulle : sous la cible si la place le permet, sinon au-dessus ;
  // centrée s'il n'y a pas de cible.
  React.useEffect(() => {
    if (!open) return;
    const bh = bubbleRef.current?.offsetHeight ?? 200;
    const bw = bubbleRef.current?.offsetWidth ?? 340;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      setPos({ top: Math.max(24, (vh - bh) / 2), left: Math.max(12, (vw - bw) / 2) });
      return;
    }
    const left = Math.min(Math.max(12, rect.left), vw - bw - 12);
    // Cible plus haute que l'écran (grille du mois, tableau des tâches) :
    // ni dessous ni dessus n'existe, la bulle se cale en bas — au-dessus de
    // la barre d'onglets sur téléphone.
    if (rect.height > vh - bh - 48) {
      const nav = vw < 768 ? 64 : 0;
      setPos({ top: vh - bh - 12 - nav, left });
      return;
    }
    const below = rect.bottom + 12 + bh < vh;
    const top = below ? rect.bottom + 12 : Math.max(12, rect.top - bh - 12);
    setPos({ top, left });
  }, [rect, open, step]);

  if (!open) return null;

  const s = steps[step];
  const last = step === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal aria-label="Visite guidée">
      {/* Bloque les clics ; fond plein quand il n'y a pas de cible. */}
      <div
        className="absolute inset-0"
        style={rect ? undefined : { background: VEIL }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Projecteur : cadre sur la cible, le reste assombri. */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-accent transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: `0 0 0 9999px ${VEIL}`,
          }}
        />
      )}

      <div
        ref={bubbleRef}
        className="absolute w-[min(340px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-4 shadow-lift transition-all duration-200"
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          opacity: pos ? 1 : 0,
        }}
      >
        <button
          type="button"
          onClick={finish}
          aria-label="Fermer la visite"
          className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <KreaBadge className="mb-1.5" />
        <h3 className="pe-6 text-base font-bold">{s.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground/80">{s.body}</p>

        {steps.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-5 bg-foreground/60" : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="rtl-flip size-3.5" />
              Précédent
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={finish}>
              Passer
            </Button>
          )}
          {last ? (
            <Button size="sm" onClick={finish}>
              C&apos;est parti
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              Suivant
              <ArrowRight className="rtl-flip size-3.5" />
            </Button>
          )}
        </div>

        {/* Couper pour de bon, sans passer par le profil — mais pas d'un
            pouce qui glisse : un dernier mot dit où me retrouver. */}
        {confirmingOff ? (
          <div className="mt-3 rounded-xl bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground">
            <p>
              D&apos;accord, je ne t&apos;interromps plus. Pour me retrouver :
              Mon profil › Krea te guide.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmingOff(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={disable}>
                Compris
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setConfirmingOff(true)}
              className="inline-block text-xs font-medium text-muted transition hover:text-foreground"
            >
              Ne plus me guider
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
