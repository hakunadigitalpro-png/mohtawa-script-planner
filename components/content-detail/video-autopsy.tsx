"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Microscope, Sparkles, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";
import { generateVideoAutopsy } from "@/app/(app)/contents/ai-actions";

/**
 * Autopsie IA d'une vidéo (Analytics killer feature).
 *
 * L'utilisateur fournit :
 *  - le transcript (ce qui est dit)
 *  - une capture d'écran des insights (Claude multimodal lit la courbe de
 *    rétention + les stats + le label directement dans l'image)
 *  - quelques stats clés saisies (durée, vue moyenne, label de perf)
 *
 * Claude croise tout ça pour expliquer pourquoi la vidéo marche ou rate,
 * et propose la prochaine vidéo. Analyse single-vidéo (pas de comparaison),
 * multilingue (FR + arabe/dialectes), ne refuse jamais.
 */
const PERFORMANCE_LABELS = [
  { value: "", label: "— Non précisé —" },
  { value: "Plus de vues que d'habitude", label: "Plus que d'habitude 🟢" },
  { value: "Dans la moyenne", label: "Dans la moyenne 🟡" },
  { value: "Moins de vues que d'habitude", label: "Moins que d'habitude 🔴" },
];

export function VideoAutopsy({
  contentId,
  initialTranscript,
  initialRetentionNotes,
  initialAutopsy,
  autopsyAt,
  initialInsightsImageUrl,
  initialAvgWatchSeconds,
  initialVideoDurationSeconds,
  initialPerformanceLabel,
}: {
  contentId: string;
  initialTranscript: string | null;
  initialRetentionNotes: string | null;
  initialAutopsy: string | null;
  autopsyAt: string | null;
  initialInsightsImageUrl: string | null;
  initialAvgWatchSeconds: number | null;
  initialVideoDurationSeconds: number | null;
  initialPerformanceLabel: string | null;
}) {
  const router = useRouter();
  const [transcript, setTranscript] = React.useState(initialTranscript ?? "");
  const [insightsImageUrl, setInsightsImageUrl] = React.useState<string | null>(
    initialInsightsImageUrl,
  );
  const [duration, setDuration] = React.useState(
    initialVideoDurationSeconds != null
      ? String(initialVideoDurationSeconds)
      : "",
  );
  const [avgWatch, setAvgWatch] = React.useState(
    initialAvgWatchSeconds != null ? String(initialAvgWatchSeconds) : "",
  );
  const [perfLabel, setPerfLabel] = React.useState(
    initialPerformanceLabel ?? "",
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
          retentionNotes: null,
          avgWatchSeconds: avgWatch ? Number(avgWatch) : null,
          videoDurationSeconds: duration ? Number(duration) : null,
          performanceLabel: perfLabel || null,
          insightsImageUrl,
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
            Croise ton script + tes insights pour comprendre ce qui a marché.
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
            placeholder={`Colle ce qui est dit dans la vidéo (sous-titres auto IG/TikTok). FR ou arabe — l'IA s'adapte.`}
            disabled={pending}
          />
        </div>

        {/* Capture des insights (lue par l'IA). Largeur contrainte pour
            éviter que la zone portrait 9:16 ne prenne tout l'écran. */}
        <div className="space-y-1.5">
          <Label>Capture d&apos;écran des insights (recommandé)</Label>
          <p className="text-[10px] text-muted">
            Uploade ta capture Instagram/TikTok (courbe de rétention + stats).
            L&apos;IA la lit directement — pas besoin de tout retaper.
          </p>
          <div className="w-40">
            <ImageUpload
              contentId={contentId}
              value={insightsImageUrl}
              aspectRatio="portrait"
              onChange={setInsightsImageUrl}
              label="Ajouter la capture"
            />
          </div>
        </div>

        {/* Stats clés rapides */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="autopsy-duration">Durée vidéo (sec)</Label>
            <Input
              id="autopsy-duration"
              type="number"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex : 20"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="autopsy-avgwatch">Vue moyenne (sec)</Label>
            <Input
              id="autopsy-avgwatch"
              type="number"
              inputMode="numeric"
              value={avgWatch}
              onChange={(e) => setAvgWatch(e.target.value)}
              placeholder="Ex : 7"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="autopsy-label">Verdict plateforme</Label>
            <Select
              id="autopsy-label"
              value={perfLabel}
              onValueChange={setPerfLabel}
              options={PERFORMANCE_LABELS}
              placeholder="— Non précisé —"
            />
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
