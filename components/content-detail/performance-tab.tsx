"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertPerformance } from "@/app/(app)/contents/actions";
import { useAutosave, AutosaveIndicator } from "./autosave-field";
import type { Performance } from "@/lib/types";

export function PerformanceTab({
  contentId,
  perf,
}: {
  contentId: string;
  perf: Performance | null;
}) {
  const t = useTranslations("performance");
  const [state, setState] = useState({
    views: perf?.views?.toString() ?? "",
    likes: perf?.likes?.toString() ?? "",
    comments: perf?.comments?.toString() ?? "",
    shares: perf?.shares?.toString() ?? "",
    saves: perf?.saves?.toString() ?? "",
    retention: perf?.retention?.toString() ?? "",
    notes: perf?.notes ?? "",
  });

  const status = useAutosave(state, async (v) =>
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
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted">{t("subtitle")}</p>
        </div>
        <AutosaveIndicator status={status} />
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
  );
}
