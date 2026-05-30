"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Microscope, Sparkles, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";
import { generateVideoAutopsy } from "@/app/(app)/contents/ai-actions";

/**
 * Autopsie IA d'une vidéo (Analytics killer feature).
 *
 * Flow minimaliste :
 *  - transcript (ce qui est dit)
 *  - PLUSIEURS captures d'écran des insights (courbe de rétention, stats,
 *    portée, label…). Claude (multimodal) les lit toutes et en extrait
 *    tout — pas de saisie manuelle de durée/vue moyenne/label.
 *
 * Single-vidéo, multilingue (FR + arabe/dialectes), ne refuse jamais.
 */
export function VideoAutopsy({
  contentId,
  initialTranscript,
  initialAutopsy,
  autopsyAt,
  initialInsightsImageUrls,
}: {
  contentId: string;
  initialTranscript: string | null;
  initialAutopsy: string | null;
  autopsyAt: string | null;
  initialInsightsImageUrls: string[];
}) {
  const router = useRouter();
  const [transcript, setTranscript] = React.useState(initialTranscript ?? "");
  const [images, setImages] = React.useState<string[]>(
    initialInsightsImageUrls ?? [],
  );
  const [autopsy, setAutopsy] = React.useState(initialAutopsy ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addImage = (url: string | null) => {
    if (url) setImages((prev) => [...prev, url]);
  };
  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

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
          insightsImageUrls: images,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setAutopsy(res.autopsy);
        router.refresh();
      } catch {
        setError(
          "L'analyse a échoué (délai dépassé ou réseau). Réessaie dans un instant.",
        );
      } finally {
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
            Croise ton script + tes captures d&apos;insights pour comprendre ce
            qui a marché.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Transcript */}
        <div className="space-y-1.5">
          <Label htmlFor="autopsy-transcript">Transcript de la vidéo</Label>
          <Textarea
            id="autopsy-transcript"
            className="min-h-28 text-sm [field-sizing:content]"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Colle ce qui est dit dans la vidéo (sous-titres auto IG/TikTok). FR ou arabe — l'IA s'adapte."
            disabled={pending}
          />
        </div>

        {/* Captures des insights (plusieurs, petites) */}
        <div className="space-y-1.5">
          <Label>Captures des insights</Label>
          <p className="text-[10px] text-muted">
            Ajoute autant de captures que tu veux (courbe de rétention, stats,
            portée…). L&apos;IA lit tout dedans.
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {/* Vignettes déjà ajoutées */}
            {images.map((url, idx) => (
              <div key={`${url}-${idx}`} className="w-20">
                <ImageUpload
                  contentId={contentId}
                  value={url}
                  aspectRatio="portrait"
                  onChange={(v) => {
                    if (v === null) removeImage(idx);
                  }}
                  label=""
                />
              </div>
            ))}
            {/* Slot d'ajout (toujours vide → append au upload) */}
            <div className="w-20">
              <ImageUpload
                key={`add-${images.length}`}
                contentId={contentId}
                value={null}
                aspectRatio="portrait"
                onChange={addImage}
                label="+ Capture"
              />
            </div>
          </div>
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
          ? "Analyse en cours… (~20s)"
          : hasAutopsy
            ? "Relancer l'analyse"
            : "Analyser avec l'IA"}
      </Button>

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
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
            dir="auto"
          >
            {autopsy}
          </div>
        </div>
      )}
    </div>
  );
}
