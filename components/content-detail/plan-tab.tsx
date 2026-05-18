"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SelectWithCreate } from "@/components/ui/select-with-create";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { platformsForType, STATUSES, CONTENT_TYPES } from "@/lib/constants";
import { updateContent } from "@/app/(app)/contents/actions";
import { createTaxonomy } from "@/app/(app)/brands/taxonomy-actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import { HooksPickerButton } from "@/components/hooks-picker";
import { PillarHelp } from "@/components/field-help/pillar-help";
import { CommentButton } from "@/components/comments";
import type { Content } from "@/lib/types";

function safeT(fn: (k: string) => string, key: string, fallback: string) {
  try {
    return fn(key);
  } catch {
    return fallback;
  }
}

export function PlanTab({
  content,
  brandPillars,
  brandObjectives,
}: {
  content: Content;
  brandPillars: { id: string; name: string }[];
  brandObjectives: { id: string; name: string }[];
}) {
  const t = useTranslations("plan");
  const tType = useTranslations("contentTypes");
  const tPlatform = useTranslations("platforms");
  const tStatus = useTranslations("statuses");

  // L'`initial` est stabilisé pour éviter de re-trigger l'effet de resync à
  // chaque render (le useExplicitSave compare via JSON.stringify).
  const initial = useMemo(
    () => ({
      title: content.title ?? "",
      type: content.type,
      platform: content.platform ?? "",
      pillar: content.pillar ?? "",
      objective: content.objective ?? "",
      date: content.date ?? "",
      status: content.status,
      hook: content.hook ?? "",
      cta: content.cta ?? "",
      tags: (content.tags ?? []).join(", "),
    }),
    [
      content.title,
      content.type,
      content.platform,
      content.pillar,
      content.objective,
      content.date,
      content.status,
      content.hook,
      content.cta,
      content.tags,
    ],
  );

  const { state, setState, isDirty, isSaving, handleSave, handleReset } =
    useExplicitSave(initial, async (v) =>
      updateContent(content.id, {
        title: v.title || undefined,
        platform: v.platform || null,
        pillar: v.pillar || null,
        objective: v.objective || null,
        date: v.date || null,
        status: v.status,
        hook: v.hook || null,
        cta: v.cta || null,
        tags: v.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    );

  return (
    <div className="space-y-4">
      <Card className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{t("sectionTitle")}</h2>
          <CommentButton targetType="plan" targetId="general" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">{t("videoTitle")}</Label>
          <Input
            id="title"
            value={state.title}
            onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            placeholder={t("videoTitlePlaceholder")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">{t("format")}</Label>
            <Select
              id="type"
              value={state.type}
              disabled
              onValueChange={(v) => setState((s) => ({ ...s, type: v }))}
              options={CONTENT_TYPES.map((ct) => ({
                value: ct.value,
                label: safeT(tType, ct.value, ct.label),
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform">{t("platform")}</Label>
            <Select
              id="platform"
              value={state.platform}
              onValueChange={(v) => setState((s) => ({ ...s, platform: v }))}
              placeholder="—"
              options={platformsForType(state.type).map((p) => ({
                value: p.value,
                label: safeT(tPlatform, p.value, p.label),
              }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="pillar">{t("pillar")}</Label>
              <PillarHelp />
            </div>
            <SelectWithCreate
              id="pillar"
              value={state.pillar}
              onValueChange={(v) => setState((s) => ({ ...s, pillar: v }))}
              options={brandPillars.map((p) => ({ value: p.name, label: p.name }))}
              placeholder={t("pillarPlaceholder")}
              inputLabel={t("pillar")}
              inputPlaceholder={t("pillarPlaceholder")}
              createDialogTitle={t("pillar")}
              createDialogDescription=""
              createLabel={t("pillar")}
              onCreate={async (name) =>
                createTaxonomy("pillar", content.brand_id, name)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objective">{t("objective")}</Label>
            <SelectWithCreate
              id="objective"
              value={state.objective}
              onValueChange={(v) => setState((s) => ({ ...s, objective: v }))}
              options={brandObjectives.map((o) => ({ value: o.name, label: o.name }))}
              placeholder={t("objective")}
              inputLabel={t("objective")}
              inputPlaceholder="Ex : Lead generation"
              createDialogTitle={t("objective")}
              createDialogDescription=""
              createLabel={t("objective")}
              onCreate={async (name) =>
                createTaxonomy("objective", content.brand_id, name)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">{t("date")}</Label>
            <Input
              id="date"
              type="date"
              value={state.date}
              onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">{t("status")}</Label>
            <Select
              id="status"
              value={state.status}
              onValueChange={(v) => setState((s) => ({ ...s, status: v }))}
              options={STATUSES.map((s) => ({
                value: s.value,
                label: safeT(tStatus, s.value, s.label),
              }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="hook">{t("hook")}</Label>
              <CommentButton targetType="plan" targetId="hook" />
            </div>
            <HooksPickerButton
              onPick={(text) => setState((s) => ({ ...s, hook: text }))}
            />
          </div>
          <Textarea
            id="hook"
            value={state.hook}
            onChange={(e) => setState((s) => ({ ...s, hook: e.target.value }))}
            placeholder={t("hookPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="cta">{t("cta")}</Label>
            <CommentButton targetType="plan" targetId="cta" />
          </div>
          <Input
            id="cta"
            value={state.cta}
            onChange={(e) => setState((s) => ({ ...s, cta: e.target.value }))}
            placeholder={t("ctaPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">{t("tags")}</Label>
          <Input
            id="tags"
            value={state.tags}
            onChange={(e) => setState((s) => ({ ...s, tags: e.target.value }))}
            placeholder={t("tagsPlaceholder")}
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
