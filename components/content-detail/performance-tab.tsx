"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertPerformance,
  updateContent,
} from "@/app/(app)/contents/actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import type { Performance } from "@/lib/types";

export function PerformanceTab({
  contentId,
  perf,
  videoUrl,
}: {
  contentId: string;
  perf: Performance | null;
  /** URL de la vidéo publiée (Idée 12, migration 0017). */
  videoUrl: string | null;
}) {
  const t = useTranslations("performance");

  const initial = useMemo(
    () => ({
      videoUrl: videoUrl ?? "",
      views: perf?.views?.toString() ?? "",
      likes: perf?.likes?.toString() ?? "",
      comments: perf?.comments?.toString() ?? "",
      shares: perf?.shares?.toString() ?? "",
      saves: perf?.saves?.toString() ?? "",
      retention: perf?.retention?.toString() ?? "",
      notes: perf?.notes ?? "",
    }),
    [
      videoUrl,
      perf?.views,
      perf?.likes,
      perf?.comments,
      perf?.shares,
      perf?.saves,
      perf?.retention,
      perf?.notes,
    ],
  );

  const { state, setState, isDirty, isSaving, handleSave, handleReset } =
    useExplicitSave(initial, async (v) => {
      // 2 mutations en parallèle : performances (stats) + contents (video_url)
      const [perfRes, contentRes] = await Promise.all([
        upsertPerformance(contentId, {
          views: v.views ? Number(v.views) : undefined,
          likes: v.likes ? Number(v.likes) : undefined,
          comments: v.comments ? Number(v.comments) : undefined,
          shares: v.shares ? Number(v.shares) : undefined,
          saves: v.saves ? Number(v.saves) : undefined,
          retention: v.retention ? Number(v.retention) : undefined,
          notes: v.notes || undefined,
        }),
        updateContent(contentId, {
          // null si l'user a vidé le champ → on clear côté DB
          video_url: v.videoUrl.trim() || null,
        }),
      ]);
      const firstError = [perfRes, contentRes].find(
        (r) => r && typeof r === "object" && "error" in r && r.error,
      );
      return firstError ?? { ok: true };
    });

  const num = (k: keyof typeof state, label: string) => (
    <div className="space-y-2">
      <Label htmlFor={k}>{label}</Label>
      <Input
        id={k}
        type="number"
        inputMode="numeric"
        value={state[k]}
        onChange={(e) => setState((s) => ({ ...s, [k]: e.target.value }))}
      />
    </div>
  );

  // Validation/normalisation légère de l'URL pour le bouton "Voir en ligne".
  // On ne casse pas la saisie en cours — on ouvre seulement le lien si l'URL
  // ressemble à quelque chose de browsable (http/https/// raccourci).
  const rawUrl = state.videoUrl.trim();
  const browsableUrl = rawUrl
    ? rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : `https://${rawUrl}`
    : null;

  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted">{t("subtitle")}</p>
        </div>

        {/* URL de la vidéo publiée (Idée 12) */}
        <div className="space-y-2">
          <Label
            htmlFor="video_url"
            className="flex items-center gap-1.5"
          >
            <LinkIcon className="size-3.5" />
            Lien de la vidéo publiée
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="video_url"
              type="url"
              inputMode="url"
              value={state.videoUrl}
              onChange={(e) =>
                setState((s) => ({ ...s, videoUrl: e.target.value }))
              }
              placeholder="https://www.instagram.com/reel/..."
              className="flex-1"
            />
            {browsableUrl && (
              <a
                href={browsableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15"
                title="Ouvre la vidéo dans un nouvel onglet"
              >
                <ExternalLink className="size-3.5" />
                Voir en ligne
              </a>
            )}
          </div>
          <p className="text-[10px] text-muted">
            Colle l&apos;URL publique de ta vidéo (Reel Instagram, TikTok, etc.)
            pour la retrouver d&apos;un clic et matcher tes stats plus tard.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {num("views", t("views"))}
          {num("likes", t("likes"))}
          {num("comments", t("comments"))}
          {num("shares", t("shares"))}
          {num("saves", t("saves"))}
          {num("retention", t("retention"))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t("notes")}</Label>
          <Textarea
            id="notes"
            className="min-h-32"
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder={t("notesPlaceholder")}
          />
        </div>
      </Card>

      <SaveFooter
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
      />
    </div>
  );
}
