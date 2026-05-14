"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { AiGeneratorButton } from "@/components/ai-generator";
import { STORY_SLOT_LABELS } from "@/lib/constants";
import {
  upsertReelDetails,
  upsertStoryDetails,
  upsertStorySlide,
} from "@/app/(app)/contents/actions";
import { useAutosave, AutosaveIndicator } from "./autosave-field";
import type { Content, ReelDetails, StoryDetails, StorySlide } from "@/lib/types";

export function ScriptTab({
  content,
  reel,
  story,
  slides,
}: {
  content: Content;
  reel: ReelDetails | null;
  story: StoryDetails | null;
  slides: StorySlide[];
}) {
  if (content.type === "story") {
    return <StoryScript contentId={content.id} story={story} slides={slides} />;
  }
  return <ReelScript contentId={content.id} reel={reel} />;
}

/* ============================== REEL ============================== */

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

  const status = useAutosave(state, async (v) => upsertReelDetails(contentId, v));

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Structure du script</h2>
          <p className="text-xs text-muted">
            Une idée = un point. Structure d&apos;abord, tournage ensuite.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutosaveIndicator status={status} />
          <AiGeneratorButton contentId={contentId} type="reel" />
        </div>
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

/* ============================== STORY ============================== */

function StoryScript({
  contentId,
  story,
  slides: initialSlides,
}: {
  contentId: string;
  story: StoryDetails | null;
  slides: StorySlide[];
}) {
  // Header autosave
  const [header, setHeader] = useState({
    objective: story?.objective ?? "",
    cta_soft: story?.cta_soft ?? "",
  });
  const headerStatus = useAutosave(header, async (v) =>
    upsertStoryDetails(contentId, v),
  );

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Storyboard Planner</h2>
          <p className="text-xs text-muted">
            5 stories : de l&apos;intro au call-to-action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutosaveIndicator status={headerStatus} />
          <AiGeneratorButton contentId={contentId} type="story" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            What story do I want to tell ?
          </Label>
          <Textarea
            className="min-h-20 text-sm"
            value={header.objective}
            onChange={(e) => setHeader((s) => ({ ...s, objective: e.target.value }))}
            placeholder="Objectif de la séquence : transmettre quoi, à qui ?"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            My engagement goals
          </Label>
          <Textarea
            className="min-h-20 text-sm"
            value={header.cta_soft}
            onChange={(e) => setHeader((s) => ({ ...s, cta_soft: e.target.value }))}
            placeholder="DM, sticker question, swipe up... que veux-tu que l'audience fasse ?"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((slot) => {
          const slide =
            initialSlides.find((s) => s.slot_number === slot) ?? null;
          return (
            <PhoneCard
              key={slot}
              contentId={contentId}
              slotNumber={slot}
              slide={slide}
            />
          );
        })}
      </div>
    </Card>
  );
}

function PhoneCard({
  contentId,
  slotNumber,
  slide,
}: {
  contentId: string;
  slotNumber: number;
  slide: StorySlide | null;
}) {
  const [state, setState] = useState({
    body: slide?.body ?? "",
    image_url: slide?.image_url ?? null,
  });

  // Debounced autosave on body
  const [, startTransition] = useTransition();
  const initial = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        await upsertStorySlide(contentId, slotNumber, { body: state.body });
      });
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.body]);

  const onImageChange = (url: string | null) => {
    setState((s) => ({ ...s, image_url: url }));
    startTransition(async () => {
      await upsertStorySlide(contentId, slotNumber, { image_url: url });
    });
  };

  const label =
    slotNumber === 1
      ? "Title / Introduction"
      : slotNumber === 5
        ? "Call to Action"
        : STORY_SLOT_LABELS[slotNumber] ?? `Story ${slotNumber}`;

  return (
    <div className="flex flex-col items-center">
      <span className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </span>

      {/* Phone frame */}
      <div className="w-full overflow-hidden rounded-[20px] border-4 border-foreground/80 bg-card shadow-sm">
        <ImageUpload
          contentId={contentId}
          value={state.image_url}
          aspectRatio="portrait"
          onChange={onImageChange}
          label="Ajouter une image"
        />
      </div>

      <Textarea
        className="mt-2 min-h-20 w-full text-xs"
        value={state.body}
        onChange={(e) => setState((s) => ({ ...s, body: e.target.value }))}
        placeholder="Texte / dialogue / notes"
      />
    </div>
  );
}

/* ============================ Shared ============================ */

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
