"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MultiSelectWithCreate } from "@/components/ui/multi-select-with-create";
import { Card } from "@/components/ui/card";
import { statusesForType, CONTENT_TYPES } from "@/lib/constants";
import { updateContent } from "@/app/(app)/contents/actions";
import { createTaxonomy } from "@/app/(app)/brands/taxonomy-actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import { PillarHelp } from "@/components/field-help/pillar-help";
import { CommentButton } from "@/components/comments";
import { PublicationsEditor } from "./publications-editor";
import type { Content, ContentPublication } from "@/lib/types";

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
  publications,
}: {
  content: Content;
  brandPillars: { id: string; name: string; objective?: string | null }[];
  // Conservé dans le type (passé par DetailTabs) mais l'ancien champ à
  // étiquettes "Objectifs" a été remplacé par l'objectif hérité du pilier.
  brandObjectives?: { id: string; name: string }[];
  publications: ContentPublication[];
}) {
  const t = useTranslations("plan");
  const tType = useTranslations("contentTypes");
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
      // Idée 10 : platform et date ne vivent plus dans le form du Plan.
      // Ils sont gérés par le PublicationsEditor (actions atomiques sur
      // content_publications). Le trigger côté DB resynchronise les
      // colonnes singulières contents.platform / date / video_url.
      // Multi-piliers / multi-objectifs (Idée 8, migration 0018)
      pillars: content.pillars ?? [],
      objectives: content.objectives ?? [],
      status: content.status,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      content.title,
      content.type,
      pillarsKey,
      objectivesKey,
      content.status,
    ],
  );

  const { state, setState, isDirty, isSaving, handleSave, handleReset } =
    useExplicitSave(initial, async (v) =>
      updateContent(content.id, {
        title: v.title || undefined,
        // Les colonnes singulières pillar/objective seront auto-synchronisées
        // côté DB via trigger sur le 1er élément de l'array (migration 0018).
        pillars: v.pillars,
        objectives: v.objectives,
        status: v.status,
      }),
    );

  // Objectif hérité du/des pilier(s) sélectionné(s) : dès qu'un pilier a un
  // objectif rempli (Marques → Piliers), il remonte ici automatiquement.
  // Source unique = le pilier → toujours à jour (pas de recopie figée à
  // maintenir). Se met à jour en direct quand on change la sélection.
  const inheritedObjectives = brandPillars
    .filter((p) => state.pillars.includes(p.name) && p.objective?.trim())
    .map((p) => ({ name: p.name, objective: (p.objective as string).trim() }));

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
              options={statusesForType(content.type).map((s) => ({
                value: s.value,
                label: safeT(tStatus, s.value, s.label),
              }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="pillars">Thèmes de contenu</Label>
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
              placeholder="Aucun thème sélectionné"
              inputLabel="Nom du thème"
              inputPlaceholder="Ex : Prévention & Conseils"
              createDialogTitle="Nouveau thème"
              createDialogDescription="Cette étiquette pourra être réutilisée sur d'autres vidéos de la marque."
              createLabel="Créer un thème"
              onCreate={async (name) =>
                createTaxonomy("pillar", content.brand_id, name)
              }
            />
          </div>

          {/* Objectif : hérité automatiquement du/des pilier(s) sélectionné(s),
              en lecture seule. Source unique = le pilier (Marques → Piliers),
              donc jamais de recopie figée à maintenir. */}
          <div className="space-y-2">
            <Label>
              Objectif{" "}
              <span className="text-xs font-normal text-muted">(du thème)</span>
            </Label>
            {inheritedObjectives.length > 0 ? (
              <div
                dir="auto"
                className="rounded-2xl border border-border bg-secondary/30 px-3.5 py-2.5"
              >
                <ul className="space-y-1.5">
                  {inheritedObjectives.map((o) => (
                    <li
                      key={o.name}
                      className="text-sm leading-relaxed text-foreground/90"
                    >
                      {inheritedObjectives.length > 1 && (
                        <span className="font-semibold">{o.name} — </span>
                      )}
                      {o.objective}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-3.5 py-2.5 text-sm text-muted">
                Choisis un thème avec un objectif pour le voir apparaître ici.
              </div>
            )}
          </div>
        </div>

        {/* Multi-plateformes (Idée 10) : remplace l'ancien couple Platform +
            Date par un éditeur de N publications avec chacune sa propre
            date et son URL. Les actions sont atomiques (immédiate côté
            serveur), pas dans le Save du form parent. */}
        <PublicationsEditor
          contentId={content.id}
          contentType={content.type}
          publications={publications}
        />

        {/* Idée 11 (revue UX) : Accroche, CTA, Tags ont été retirés du Plan.
            L'Accroche vit maintenant dans l'onglet Script (renommé "Intro"
            → "Accroche"). Le CTA vit dans l'Outro. Les tags ne servaient à
            rien et ont été simplement enlevés. */}
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
