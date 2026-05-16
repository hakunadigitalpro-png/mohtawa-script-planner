"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SelectWithCreate } from "@/components/ui/select-with-create";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { platformsForType, STATUSES, CONTENT_TYPES } from "@/lib/constants";
import { updateContent } from "@/app/(app)/contents/actions";
import { createTaxonomy } from "@/app/(app)/brands/taxonomy-actions";
import { useAutosave, AutosaveIndicator } from "./autosave-field";
import { HooksPickerButton } from "@/components/hooks-picker";
import type { Content } from "@/lib/types";

export function PlanTab({
  content,
  brandPillars,
  brandObjectives,
}: {
  content: Content;
  brandPillars: { id: string; name: string }[];
  brandObjectives: { id: string; name: string }[];
}) {
  const [state, setState] = useState({
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
  });

  const status = useAutosave(state, async (v) =>
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
        .map((t) => t.trim())
        .filter(Boolean),
    }),
  );

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Informations générales</h2>
        <AutosaveIndicator status={status} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Titre de la vidéo</Label>
        <Input
          id="title"
          value={state.title}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
          placeholder="Ex : 3 erreurs que font les créateurs débutants"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Format</Label>
          <Select
            id="type"
            value={state.type}
            disabled
            onValueChange={(v) => setState((s) => ({ ...s, type: v }))}
            options={CONTENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform">Plateforme</Label>
          <Select
            id="platform"
            value={state.platform}
            onValueChange={(v) => setState((s) => ({ ...s, platform: v }))}
            placeholder="—"
            options={platformsForType(state.type).map((p) => ({ value: p.value, label: p.label }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pillar">Pilier de contenu</Label>
          <SelectWithCreate
            id="pillar"
            value={state.pillar}
            onValueChange={(v) => setState((s) => ({ ...s, pillar: v }))}
            options={brandPillars.map((p) => ({ value: p.name, label: p.name }))}
            placeholder="Choisir un pilier"
            inputLabel="Nom du pilier"
            inputPlaceholder="Ex : Marketing digital"
            createDialogTitle="Nouveau pilier"
            createDialogDescription="Disponible pour toutes les vidéos de cette marque."
            createLabel="Ajouter le pilier"
            onCreate={async (name) =>
              createTaxonomy("pillar", content.brand_id, name)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="objective">Objectif</Label>
          <SelectWithCreate
            id="objective"
            value={state.objective}
            onValueChange={(v) => setState((s) => ({ ...s, objective: v }))}
            options={brandObjectives.map((o) => ({ value: o.name, label: o.name }))}
            placeholder="Choisir un objectif"
            inputLabel="Nom de l'objectif"
            inputPlaceholder="Ex : Lead generation"
            createDialogTitle="Nouvel objectif"
            createDialogDescription="Disponible pour toutes les vidéos de cette marque."
            createLabel="Ajouter l'objectif"
            onCreate={async (name) =>
              createTaxonomy("objective", content.brand_id, name)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date prévue</Label>
          <Input
            id="date"
            type="date"
            value={state.date}
            onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Statut</Label>
          <Select
            id="status"
            value={state.status}
            onValueChange={(v) => setState((s) => ({ ...s, status: v }))}
            options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="hook">Accroche</Label>
          <HooksPickerButton
            onPick={(text) => setState((s) => ({ ...s, hook: text }))}
          />
        </div>
        <Textarea
          id="hook"
          value={state.hook}
          onChange={(e) => setState((s) => ({ ...s, hook: e.target.value }))}
          placeholder="La première phrase qui arrête le scroll."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cta">Appel à l&apos;action</Label>
        <Input
          id="cta"
          value={state.cta}
          onChange={(e) => setState((s) => ({ ...s, cta: e.target.value }))}
          placeholder="Abonne-toi / Commente / Télécharge..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (séparés par des virgules)</Label>
        <Input
          id="tags"
          value={state.tags}
          onChange={(e) => setState((s) => ({ ...s, tags: e.target.value }))}
          placeholder="marketing, débutant, conseils"
        />
      </div>
    </Card>
  );
}
