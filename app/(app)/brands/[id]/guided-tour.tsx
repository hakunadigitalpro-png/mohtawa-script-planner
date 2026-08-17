"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { HelpCircle, ArrowRight, ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KreaBadge } from "@/components/krea-avatar";

/**
 * Visite guidée en COACH-MARKS : chaque étape met en surbrillance un vrai
 * élément de la page (bouton, zone) et ancre une bulle à côté, le reste de
 * l'écran assombri (spotlight via box-shadow). Montre OÙ cliquer, pas
 * seulement du texte. Cibles repérées par des attributs `data-tour="…"`.
 *
 * S'ouvre auto une seule fois (localStorage), rejouable via le bouton.
 * Si une cible n'existe pas (ex : marque vide sans thème), l'étape s'affiche
 * centrée sans surbrillance — jamais de plantage.
 */

// v3 : passage à la voix de Krea — on rebump la clé pour que les users
// déjà passés par la v2 revoient l'intro une fois et découvrent qui elle est.
const KEY = "mohtawa_tour_brand_v3";

type Step = { selector?: string; title: string; body: string };

const STEPS: Step[] = [
  {
    title: "Salut, moi c'est Krea 👋",
    body: "En 3 étapes, je te fais passer de zéro à un planning de contenus. Je te montre exactement où cliquer.",
  },
  {
    selector: '[data-tour="create-themes"]',
    title: "Étape 1 · Crée tes thèmes",
    body: "Clique ce bouton : réponds à 2-3 questions simples et je construis tes thèmes de contenu, avec des idées prêtes à l'emploi.",
  },
  {
    selector: '[data-tour="themes-list"]',
    title: "Étape 2 · D'une idée à un contenu",
    body: "Tes thèmes s'affichent ici. Survole une idée d'exemple et clique le bouton 🎬 : un contenu se crée déjà rempli.",
  },
  {
    title: "C'est parti 🚀",
    body: "Retrouve ensuite tes contenus au Dashboard et au Calendrier — script, checklist de tournage et date de publication. Je reste dispo à chaque étape via le bouton « Générer avec Krea ».",
  },
];

export function GuidedTour() {
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null,
  );
  const bubbleRef = React.useRef<HTMLDivElement>(null);

  // Déclaré avant les effets ci-dessous : l'écouteur Escape le référence.
  const finish = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    setStep(0);
    setPos(null);
    setRect(null);
  };

  React.useEffect(() => setMounted(true), []);

  // Ouverture auto une seule fois par navigateur.
  React.useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      // localStorage indisponible → on ne force rien.
    }
  }, []);

  // Localise la cible de l'étape + recalcule au scroll/resize. Escape ferme.
  React.useEffect(() => {
    if (!open) return;
    const sel = STEPS[step].selector;

    const measure = () => {
      if (!sel) {
        setRect(null);
        return;
      }
      const el = document.querySelector(sel) as HTMLElement | null;
      setRect(el ? el.getBoundingClientRect() : null);
    };

    // Amène la cible dans le viewport puis mesure (après le scroll).
    if (sel) {
      const el = document.querySelector(sel) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    measure();
    const t = setTimeout(measure, 350);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, step]);

  // Positionne la bulle par rapport à la cible (dessous si la place le permet,
  // sinon dessus ; centrée s'il n'y a pas de cible).
  React.useEffect(() => {
    if (!open) return;
    const bh = bubbleRef.current?.offsetHeight ?? 190;
    const bw = bubbleRef.current?.offsetWidth ?? 340;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!rect) {
      setPos({ top: Math.max(24, (vh - bh) / 2), left: Math.max(12, (vw - bw) / 2) });
      return;
    }
    const below = rect.bottom + 12 + bh < vh;
    const top = below ? rect.bottom + 12 : Math.max(12, rect.top - bh - 12);
    const left = Math.min(Math.max(12, rect.left), vw - bw - 12);
    setPos({ top, left });
  }, [rect, open, step]);

  const replay = () => {
    setStep(0);
    setPos(null);
    setRect(null);
    setOpen(true);
  };

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={replay}>
        <HelpCircle className="size-4" />
        Revoir avec Krea
      </Button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[100]">
            {/* Bloqueur de clics + fond sombre (plein si pas de cible). */}
            <div
              className="absolute inset-0"
              style={rect ? undefined : { background: "rgba(10,6,18,0.6)" }}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Spotlight : cadre lumineux sur la cible + assombrissement autour. */}
            {rect && (
              <div
                className="pointer-events-none absolute rounded-xl ring-2 ring-accent transition-all duration-200"
                style={{
                  top: rect.top - 6,
                  left: rect.left - 6,
                  width: rect.width + 12,
                  height: rect.height + 12,
                  boxShadow: "0 0 0 9999px rgba(10,6,18,0.6)",
                }}
              />
            )}

            {/* Bulle */}
            <div
              ref={bubbleRef}
              className="absolute w-[min(340px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-4 shadow-[0_20px_60px_-15px_rgba(10,6,18,0.45)] transition-all duration-200"
              style={{
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                opacity: pos ? 1 : 0,
              }}
            >
              <button
                type="button"
                onClick={finish}
                aria-label="Fermer"
                className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>

              <KreaBadge className="mb-1.5" />
              <h3 className="pe-6 text-base font-bold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>

              <div className="mt-3 flex items-center justify-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === step ? "w-5 bg-accent" : "w-1.5 bg-border",
                    )}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                {step > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(step - 1)}
                  >
                    <ArrowLeft className="size-3.5" />
                    Précédent
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={finish}>
                    Passer
                  </Button>
                )}

                {isLast ? (
                  <Button size="sm" onClick={finish}>
                    C&apos;est parti 🚀
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setStep(step + 1)}>
                    Suivant
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
