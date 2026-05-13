"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { upsertReelDetails, upsertStoryDetails } from "@/app/(app)/contents/actions";
import { useAutosave, AutosaveIndicator } from "./autosave-field";
import type { Content, ReelDetails, StoryDetails } from "@/lib/types";

export function ScriptTab({
  content,
  reel,
  story,
}: {
  content: Content;
  reel: ReelDetails | null;
  story: StoryDetails | null;
}) {
  if (content.type === "story") {
    return <StoryScript contentId={content.id} story={story} />;
  }
  return <ReelScript contentId={content.id} reel={reel} />;
}

function ReelScript({
  contentId,
  reel,
}: {
  contentId: string;
  reel: ReelDetails | null;
}) {
  const [state, setState] = useState({
    intro: reel?.intro ?? "",
    point1: reel?.point1 ?? "",
    point2: reel?.point2 ?? "",
    point3: reel?.point3 ?? "",
    transition: reel?.transition ?? "",
    recap: reel?.recap ?? "",
    outro: reel?.outro ?? "",
    script_full: reel?.script_full ?? "",
  });

  const status = useAutosave(state, async (v) =>
    upsertReelDetails(contentId, v),
  );

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Structure du script</h2>
          <p className="text-xs text-muted">Une idée = un point. Structure d&apos;abord, tournage ensuite.</p>
        </div>
        <AutosaveIndicator status={status} />
      </div>

      <Field label="Introduction" id="intro" placeholder="Présente le sujet en une ou deux phrases."
        value={state.intro} onChange={(v) => setState((s) => ({ ...s, intro: v }))} />

      <div className="space-y-4">
        <Label>Points principaux</Label>
        <Field label="Point 1" id="point1" value={state.point1}
          onChange={(v) => setState((s) => ({ ...s, point1: v }))} />
        <Field label="Point 2" id="point2" value={state.point2}
          onChange={(v) => setState((s) => ({ ...s, point2: v }))} />
        <Field label="Point 3" id="point3" value={state.point3}
          onChange={(v) => setState((s) => ({ ...s, point3: v }))} />
      </div>

      <Field label="Transition / B-roll" id="transition"
        placeholder="Indique les plans ou éléments visuels à ajouter."
        value={state.transition} onChange={(v) => setState((s) => ({ ...s, transition: v }))} />

      <Field label="Récapitulatif" id="recap" value={state.recap}
        onChange={(v) => setState((s) => ({ ...s, recap: v }))} />

      <Field label="Conclusion (Outro)" id="outro" value={state.outro}
        onChange={(v) => setState((s) => ({ ...s, outro: v }))} />

      <div className="space-y-2">
        <Label htmlFor="script_full">Script complet (optionnel)</Label>
        <Textarea
          id="script_full"
          className="min-h-40"
          value={state.script_full}
          onChange={(e) => setState((s) => ({ ...s, script_full: e.target.value }))}
          placeholder="Colle ou écris ton script complet ici."
        />
      </div>
    </Card>
  );
}

function StoryScript({
  contentId,
  story,
}: {
  contentId: string;
  story: StoryDetails | null;
}) {
  const [state, setState] = useState({
    objective: story?.objective ?? "",
    cta_soft: story?.cta_soft ?? "",
    format: story?.format ?? "",
    story1: story?.story1 ?? "",
    story2: story?.story2 ?? "",
    story3: story?.story3 ?? "",
    story4: story?.story4 ?? "",
    story5: story?.story5 ?? "",
  });

  const status = useAutosave(state, async (v) =>
    upsertStoryDetails(contentId, v),
  );

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Séquence Story</h2>
        <AutosaveIndicator status={status} />
      </div>

      <Field label="Objectif de la séquence" id="obj" value={state.objective}
        onChange={(v) => setState((s) => ({ ...s, objective: v }))} />
      <Field label="CTA soft" id="cta_soft" value={state.cta_soft}
        onChange={(v) => setState((s) => ({ ...s, cta_soft: v }))}
        placeholder="Ex : DM pour en savoir plus, sticker question..." />
      <Field label="Format" id="format" value={state.format}
        onChange={(v) => setState((s) => ({ ...s, format: v }))}
        placeholder="facecam, repost, screenshot, b-roll..." />

      <div className="space-y-3">
        <Label>Stories</Label>
        {[1, 2, 3, 4, 5].map((n) => (
          <Field
            key={n}
            label={`Story ${n}`}
            id={`story${n}`}
            value={state[`story${n}` as keyof typeof state]}
            onChange={(v) => setState((s) => ({ ...s, [`story${n}`]: v }))}
          />
        ))}
      </div>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
