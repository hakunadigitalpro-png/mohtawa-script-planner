"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertPerformance } from "@/app/(app)/contents/actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import { PerformancePublications } from "./performance-publications";
// VideoAutopsy (autopsie IA) parké — voir WISHLIST.md. Import + rendu retirés
// pour recentrer l'app ; le composant reste dans le repo pour réactivation.
import type { Performance, ContentPublication } from "@/lib/types";

export function PerformanceTab({
  contentId,
  perf,
  publications,
}: {
  contentId: string;
  perf: Performance | null;
  /** Publications multi-plateformes (Idée 10, migration 0020). Chaque
   *  publication a son propre champ URL éditable dans cet onglet. */
  publications: ContentPublication[];
}) {
  const t = useTranslations("performance");

  const initial = useMemo(
    () => ({
      views: perf?.views?.toString() ?? "",
      likes: perf?.likes?.toString() ?? "",
      comments: perf?.comments?.toString() ?? "",
      shares: perf?.shares?.toString() ?? "",
      saves: perf?.saves?.toString() ?? "",
      retention: perf?.retention?.toString() ?? "",
      notes: perf?.notes ?? "",
    }),
    [
      perf?.views,
      perf?.likes,
      perf?.comments,
      perf?.shares,
      perf?.saves,
      perf?.retention,
      perf?.notes,
    ],
  );

  const { state, setState, isDirty, isSaving, error, handleSave, handleReset } =
    useExplicitSave(initial, async (v) =>
      upsertPerformance(contentId, {
        views: v.views ? Number(v.views) : undefined,
        likes: v.likes ? Number(v.likes) : undefined,
        comments: v.comments ? Number(v.comments) : undefined,
        shares: v.shares ? Number(v.shares) : undefined,
        saves: v.saves ? Number(v.saves) : undefined,
        retention: v.retention ? Number(v.retention) : undefined,
        notes: v.notes || undefined,
      }),
    );

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

  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted">{t("subtitle")}</p>
        </div>

        {/* Liens des publications par plateforme (Idée 10 V2, ex-Idée 12).
            Chaque publication a son propre champ URL en auto-save. */}
        <PerformancePublications
          contentId={contentId}
          publications={publications}
        />

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
        error={error}
        onSave={handleSave}
        onReset={handleReset}
      />
    </div>
  );
}
