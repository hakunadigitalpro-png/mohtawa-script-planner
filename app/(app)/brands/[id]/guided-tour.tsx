"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Visite guidée d'onboarding, montrée à la 1re configuration d'une marque
 * (pop-ups en étapes). S'ouvre automatiquement une seule fois (drapeau
 * localStorage) et reste rejouable via le bouton « Visite guidée ». Langage
 * patron, zéro jargon — cohérent avec la cible SBO.
 */

const KEY = "mohtawa_tour_brand_v1";

const STEPS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "👋",
    title: "Bienvenue dans ta marque",
    body: "En 3 étapes simples, tu passes de zéro à un planning de vidéos. Je te montre le chemin ?",
  },
  {
    emoji: "✨",
    title: "Étape 1 · Tes thèmes de contenu",
    body: "Clique « Créer mes thèmes avec l'IA », réponds à 2-3 questions simples, et l'IA te propose tes thèmes déjà remplis (objectif + idées de vidéos). Tu ne pars jamais d'une page blanche.",
  },
  {
    emoji: "🎬",
    title: "Étape 2 · D'une idée à une vidéo",
    body: "Dans un thème, survole une idée d'exemple et clique le bouton vidéo : une nouvelle vidéo se crée déjà remplie (titre + thème). Il ne te reste qu'à la scripter.",
  },
  {
    emoji: "🗓️",
    title: "Étape 3 · Planifie & produis",
    body: "Retrouve tes vidéos au Dashboard et au Calendrier. Chacune a son script, sa checklist de tournage et sa date de publication.",
  },
  {
    emoji: "🚀",
    title: "C'est parti !",
    body: "Commence par créer tes thèmes — tout le reste découle de là.",
  },
];

export function GuidedTour() {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);

  // Ouverture auto une seule fois (1re visite d'une marque).
  React.useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      // localStorage indisponible → on ne force rien.
    }
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    setStep(0);
  };

  const replay = () => {
    setStep(0);
    setOpen(true);
  };

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={replay}>
        <HelpCircle className="size-4" />
        Visite guidée
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) finish();
        }}
      >
        <DialogContent className="max-w-md">
          <div className="space-y-5 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent/10 text-4xl">
              {s.emoji}
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </div>

            {/* Progression */}
            <div className="flex items-center justify-center gap-1.5">
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

            <div className="flex items-center justify-between gap-2 pt-1">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
