"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Microscope, Sparkles, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateVideoAutopsy } from "@/app/(app)/contents/ai-actions";

/**
 * Autopsie IA d'une vidéo (Analytics killer feature, V1).
 *
 * L'utilisateur colle le transcript de sa vidéo (+ optionnellement décrit
 * les décrochages de rétention), clique "Analyser", et Claude croise le
 * wording avec les stats déjà saisies dans l'onglet Performance pour
 * expliquer pourquoi la vidéo marche ou rate.
 *
 * V1 = saisie manuelle du transcript. V2 = auto-fetch via API plateforme
 * (quand l'URL collée pourra être résolue automatiquement).
 */
export function VideoAutopsy({
  contentId,
  initialTranscript,
  initialRetentionNotes,
  initialAutopsy,
  autopsyAt,
}: {
  contentId: string;
  initialTranscript: string | null;
  initialRetentionNotes: string | null;
  initialAutopsy: string | null;
  autopsyAt: string | null;
}) {
  const router = useRouter();
  const [transcript, setTranscript] = React.useState(initialTranscript ?? "");
  const [retentionNotes, setRetentionNotes] = React.useState(
    initialRetentionNotes ?? "",
  );
  const [autopsy, setAutopsy] = React.useState(initialAutopsy ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = () => {
    if (transcript.trim().length < 10) {
      setError("Colle le transcript de ta vidéo avant d'analyser.");
      return;
    }
    setError(null);
    setPending(true);
    (async () => {
      try {
        const res = await generateVideoAutopsy({
          contentId,
          transcript,
          retentionNotes: retentionNotes || null,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setAutopsy(res.autopsy);
        router.refresh();
      } catch {
        // Couvre le cas où la fonction serveur est coupée (timeout) ou le
        // réseau échoue : sans ce catch, le spinner restait bloqué à vie.
        setError(
          "L'analyse a échoué (délai dépassé ou réseau). Réessaie dans un instant.",
        );
      } finally {
        // S'exécute TOUJOURS (succès, erreur, timeout) → le bouton se
        // débloque systématiquement.
        setPending(false);
      }
    })();
  };

  const hasAutopsy = autopsy.trim().length > 0;

  return (
    <div className="space-y-4 rounded-2xl border border-accent/20 bg-accent/[0.03] p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Microscope className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Autopsie IA</h3>
          <p className="text-[11px] text-muted">
            Croise ton script avec tes stats pour comprendre ce qui a marché.
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="autopsy-transcript">
            Transcript de la vidéo
          </Label>
          <Textarea
            id="autopsy-transcript"
            className="min-h-28 text-sm [field-sizing:content]"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={`Colle ici ce qui est dit dans la vidéo (active les sous-titres auto sur Instagram/TikTok et copie le texte).\n\nEx : "Tu fais cette erreur sur Instagram ? La plupart des créateurs la font sans le savoir..."`}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="autopsy-retention">
            Courbe de rétention (optionnel)
          </Label>
          <Textarea
            id="autopsy-retention"
            className="min-h-12 text-sm [field-sizing:content]"
            value={retentionNotes}
            onChange={(e) => setRetentionNotes(e.target.value)}
            placeholder='Décris où les gens décrochent. Ex : "Gros décrochage vers 12s, puis ça se stabilise jusqu&apos;à la fin."'
            disabled={pending}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        onClick={run}
        disabled={pending || transcript.trim().length < 10}
        className="w-full sm:w-auto"
      >
        {hasAutopsy ? (
          <RotateCcw className={cn("size-4", pending && "animate-spin")} />
        ) : (
          <Sparkles className={cn("size-4", pending && "animate-pulse")} />
        )}
        {pending
          ? "Analyse en cours… (~15s)"
          : hasAutopsy
            ? "Relancer l'analyse"
            : "Analyser avec l'IA"}
      </Button>

      {/* Résultat */}
      {hasAutopsy && (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Résultat de l&apos;autopsie
            </span>
            {autopsyAt && (
              <span className="text-[10px] text-muted">
                {new Date(autopsyAt).toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {autopsy}
          </div>
        </div>
      )}
    </div>
  );
}
