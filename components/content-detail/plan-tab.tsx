"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { platformsForType, STATUSES, OBJECTIVES, CONTENT_TYPES } from "@/lib/constants";
import { updateContent } from "@/app/(app)/contents/actions";
import { useAutosave, AutosaveIndicator } from "./autosave-field";
import type { Content } from "@/lib/types";

export function PlanTab({ content }: { content: Content }) {
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
            onChange={(e) => setState((s) => ({ ...s, type: e.target.value }))}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform">Plateforme</Label>
          <Select
            id="platform"
            value={state.platform}
            onChange={(e) => setState((s) => ({ ...s, platform: e.target.value }))}
          >
            <option value="">—</option>
            {platformsForType(state.type).map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pillar">Pilier de contenu</Label>
          <Input
            id="pillar"
            value={state.pillar}
            onChange={(e) => setState((s) => ({ ...s, pillar: e.target.value }))}
            placeholder="Ex : Marketing digital"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="objective">Objectif</Label>
          <Select
            id="objective"
            value={state.objective}
            onChange={(e) => setState((s) => ({ ...s, objective: e.target.value }))}
          >
            <option value="">—</option>
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
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
            onChange={(e) => setState((s) => ({ ...s, status: e.target.value }))}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hook">Accroche</Label>
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
