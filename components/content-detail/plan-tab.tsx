"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MultiSelectWithCreate } from "@/components/ui/multi-select-with-create";
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
  // On hash les arrays pour que useMemo détecte les changements quand on
  // ajoute/retire un pilier (sinon JSON.stringify dans useExplicitSave ne
  // re-sync pas le baseline après save).
  const pillarsKey = (content.pillars ?? []).join("|");
  const objectivesKey = (content.objectives ?? []).join("|");

  const initial = useMemo(
    () => ({
      title: content.title ?? "",
      type: content.type,
      platform: content.platform ?? "",
      // Multi-piliers / multi-objectifs (Idée 8, migration 0018)
      pillars: content.pillars ?? [],
      objectives: content.objectives ?? [],
      date: content.date ?? "",
      status: content.status,
      hook: content.hook ?? "",
      cta: content.cta ?? "",
      tags: (content.tags ?? []).join(", "),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      content.title,
      content.type,
      content.platform,
      pillarsKey,
      objectivesKey,
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
        // Les colonnes singulières pillar/objective seront auto-synchronisées
        // côté DB via trigger sur le 1er élément de l'array (migration 0018).
        pillars: v.pillars,
        objectives: v.objectives,
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
              <Label htmlFor="pillars">Piliers de contenu</Label>
              <PillarHelp />
            </div>
            <MultiSelectWithCreate
              id="pillars"
              values={state.pillars}
              onValuesChange={(next) =>
                setState((s) => ({ ...s, pillars: next }))
              }
              options={brandPillars.map((p) => ({
                value: p.name,
                label: p.name,
              }))}
              placeholder="Aucun pilier sélectionné"
              inputLabel="Nom du pilier"
              inputPlaceholder={t("pillarPlaceholder")}
              createDialogTitle="Nouveau pilier"
              createDialogDescription="Cette étiquette pourra être réutilisée sur d'autres vidéos de la marque."
              createLabel="Créer un pilier"
              onCreate={async (name) =>
                createTaxonomy("pillar", content.brand_id, name)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectives">Objectifs</Label>
            <MultiSelectWithCreate
              id="objectives"
              values={state.objectives}
              onValuesChange={(next) =>
                setState((s) => ({ ...s, objectives: next }))
              }
              options={brandObjectives.map((o) => ({
                value: o.name,
                label: o.name,
              }))}
              placeholder="Aucun objectif sélectionné"
              inputLabel="Nom de l'objectif"
              inputPlaceholder="Ex : Lead generation"
              createDialogTitle="Nouvel objectif"
              createDialogDescription="Cette étiquette pourra être réutilisée sur d'autres vidéos de la marque."
              createLabel="Créer un objectif"
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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="status">{t("status")}</Label>
              {content.auto_status && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent"
                  title="Le statut avance automatiquement selon ton avancement (script, tournage, montage…). Change-le manuellement pour désactiver."
                >
                  ✨ Auto
                </span>
              )}
            </div>
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
