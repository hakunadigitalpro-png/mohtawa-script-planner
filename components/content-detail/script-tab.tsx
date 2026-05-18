"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { AiGeneratorButton } from "@/components/ai-generator";
import { CommentButton } from "@/components/comments";
import { STORY_SLOT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  upsertReelDetails,
  upsertStoryDetails,
  upsertStorySlide,
  swapSlides,
} from "@/app/(app)/contents/actions";
import { useRouter } from "next/navigation";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import type { Content, ReelDetails, StoryDetails, StorySlide } from "@/lib/types";

const SLIDE_DRAG_MIME = "application/x-mohtawa-slot-number";

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
  const t = useTranslations("script");

  const initial = useMemo(
    () => ({
      intro: reel?.intro ?? "",
      point1: reel?.point1 ?? "",
      point2: reel?.point2 ?? "",
      point3: reel?.point3 ?? "",
      transition: reel?.transition ?? "",
      recap: reel?.recap ?? "",
      outro: reel?.outro ?? "",
      script_full: reel?.script_full ?? "",
    }),
    [
      reel?.intro,
      reel?.point1,
      reel?.point2,
      reel?.point3,
      reel?.transition,
      reel?.recap,
      reel?.outro,
      reel?.script_full,
    ],
  );

  const { state, setState, isDirty, isSaving, handleSave, handleReset } =
    useExplicitSave(initial, async (v) => upsertReelDetails(contentId, v));

  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted">{t("subtitle")}</p>
          </div>
          <AiGeneratorButton contentId={contentId} type="reel" />
        </div>

        <Field
          label={t("intro")}
          id="intro"
          commentId="intro"
          placeholder={t("introPlaceholder")}
          value={state.intro}
          onChange={(v) => setState((s) => ({ ...s, intro: v }))}
        />

        <div className="space-y-4">
          <Label>{t("mainPoints")}</Label>
          <Field
            label={t("point1")}
            id="point1"
            commentId="point1"
            value={state.point1}
            onChange={(v) => setState((s) => ({ ...s, point1: v }))}
          />
          <Field
            label={t("point2")}
            id="point2"
            commentId="point2"
            value={state.point2}
            onChange={(v) => setState((s) => ({ ...s, point2: v }))}
          />
          <Field
            label={t("point3")}
            id="point3"
            commentId="point3"
            value={state.point3}
            onChange={(v) => setState((s) => ({ ...s, point3: v }))}
          />
        </div>

        <Field
          label={t("transition")}
          id="transition"
          commentId="transition"
          placeholder={t("transitionPlaceholder")}
          value={state.transition}
          onChange={(v) => setState((s) => ({ ...s, transition: v }))}
        />

        <Field
          label={t("recap")}
          id="recap"
          commentId="recap"
          value={state.recap}
          onChange={(v) => setState((s) => ({ ...s, recap: v }))}
        />

        <Field
          label={t("outro")}
          id="outro"
          commentId="outro"
          value={state.outro}
          onChange={(v) => setState((s) => ({ ...s, outro: v }))}
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="script_full">{t("fullScript")}</Label>
            <CommentButton targetType="script" targetId="script_full" />
          </div>
          <Textarea
            id="script_full"
            className="min-h-40"
            value={state.script_full}
            onChange={(e) => setState((s) => ({ ...s, script_full: e.target.value }))}
            placeholder={t("fullScriptPlaceholder")}
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
  const router = useRouter();
  const t = useTranslations("stories");

  // L'état combine le header (objective + cta_soft) ET les 5 bodies des slides.
  // Les images restent gérées séparément (atomic upload).
  // NB : on hash les bodies dans la liste de dépendances pour que le useMemo
  // détecte un changement venant du serveur (après swap drag&drop ou upload).
  const slidesBodyHash = initialSlides
    .map((s) => `${s.slot_number}:${s.body ?? ""}`)
    .join("|");

  const initial = useMemo(
    () => ({
      objective: story?.objective ?? "",
      cta_soft: story?.cta_soft ?? "",
      bodies: [1, 2, 3, 4, 5].map(
        (slot) =>
          initialSlides.find((s) => s.slot_number === slot)?.body ?? "",
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [story?.objective, story?.cta_soft, slidesBodyHash],
  );

  const { state, setState, isDirty, isSaving, handleSave, handleReset } =
    useExplicitSave(initial, async (v) => {
      // On lance header + 5 slides en parallèle. Si un appel échoue, on retourne
      // l'erreur pour que le hook ne marque pas la baseline comme à jour.
      const ops = await Promise.all([
        upsertStoryDetails(contentId, {
          objective: v.objective,
          cta_soft: v.cta_soft,
        }),
        ...v.bodies.map((body, i) =>
          upsertStorySlide(contentId, i + 1, { body }),
        ),
      ]);
      const firstError = ops.find(
        (r) => r && typeof r === "object" && "error" in r && r.error,
      );
      return firstError ?? { ok: true };
    });

  // Drag & drop swap : action atomique → reste immédiate (sauve côté serveur tout de suite)
  // Les modifs non sauvegardées sur les bodies sont sacrifiées car router.refresh()
  // déclenche un resync.
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const onSlotDrop = (toSlot: number, e: React.DragEvent) => {
    e.preventDefault();
    setOverSlot(null);
    const fromSlot = Number(e.dataTransfer.getData(SLIDE_DRAG_MIME));
    setDragSlot(null);
    if (!Number.isFinite(fromSlot) || fromSlot === toSlot) return;
    startTransition(async () => {
      await swapSlides(contentId, fromSlot, toSlot);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted">{t("subtitle")}</p>
          </div>
          <AiGeneratorButton contentId={contentId} type="story" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {t("whatStory")}
            </Label>
            <Textarea
              className="min-h-20 text-sm"
              value={state.objective}
              onChange={(e) =>
                setState((s) => ({ ...s, objective: e.target.value }))
              }
              placeholder={t("whatStoryPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {t("engagementGoals")}
            </Label>
            <Textarea
              className="min-h-20 text-sm"
              value={state.cta_soft}
              onChange={(e) =>
                setState((s) => ({ ...s, cta_soft: e.target.value }))
              }
              placeholder={t("engagementGoalsPlaceholder")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((slot) => {
            const slide =
              initialSlides.find((s) => s.slot_number === slot) ?? null;
            return (
              <div
                key={slot}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(SLIDE_DRAG_MIME)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overSlot !== slot) setOverSlot(slot);
                }}
                onDragLeave={() => {
                  if (overSlot === slot) setOverSlot(null);
                }}
                onDrop={(e) => onSlotDrop(slot, e)}
                className={cn(
                  "transition-all",
                  dragSlot === slot && "opacity-40",
                  overSlot === slot && dragSlot !== slot && "scale-[1.03]",
                )}
              >
                <PhoneCard
                  contentId={contentId}
                  slotNumber={slot}
                  body={state.bodies[slot - 1]}
                  imageUrl={slide?.image_url ?? null}
                  onBodyChange={(v) =>
                    setState((s) => ({
                      ...s,
                      bodies: s.bodies.map((b, i) =>
                        i === slot - 1 ? v : b,
                      ),
                    }))
                  }
                  onImageChange={(url) => {
                    // Upload image = action atomique, sauve immédiat côté serveur
                    startTransition(async () => {
                      await upsertStorySlide(contentId, slot, {
                        image_url: url,
                      });
                      router.refresh();
                    });
                  }}
                  onDragHandleStart={(e) => {
                    setDragSlot(slot);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData(SLIDE_DRAG_MIME, String(slot));
                  }}
                  onDragHandleEnd={() => {
                    setDragSlot(null);
                    setOverSlot(null);
                  }}
                />
              </div>
            );
          })}
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

function PhoneCard({
  contentId,
  slotNumber,
  body,
  imageUrl,
  onBodyChange,
  onImageChange,
  onDragHandleStart,
  onDragHandleEnd,
}: {
  contentId: string;
  slotNumber: number;
  body: string;
  imageUrl: string | null;
  onBodyChange: (v: string) => void;
  onImageChange: (url: string | null) => void;
  onDragHandleStart?: (e: React.DragEvent) => void;
  onDragHandleEnd?: () => void;
}) {
  const t = useTranslations("stories");

  const label =
    slotNumber === 1
      ? t("slotLabels.title")
      : slotNumber === 5
        ? t("slotLabels.cta")
        : STORY_SLOT_LABELS[slotNumber] ??
          t("slotLabels.default", { n: slotNumber });

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1.5 flex w-full items-center justify-between gap-1">
        <div
          draggable
          onDragStart={onDragHandleStart}
          onDragEnd={onDragHandleEnd}
          className="inline-flex cursor-grab items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted active:cursor-grabbing"
          title="Glisse pour échanger avec une autre story"
        >
          <span className="text-foreground/40">⋮⋮</span>
          {label}
        </div>
        <CommentButton
          targetType="slide"
          targetId={String(slotNumber)}
          size="sm"
        />
      </div>

      {/* Phone frame */}
      <div className="w-full overflow-hidden rounded-[20px] border-4 border-foreground/80 bg-card shadow-sm">
        <ImageUpload
          contentId={contentId}
          value={imageUrl}
          aspectRatio="portrait"
          onChange={onImageChange}
          label="Ajouter une image"
        />
      </div>

      <Textarea
        className="mt-2 min-h-20 w-full text-xs"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder={t("slotPlaceholder")}
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
  commentId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Si fourni → affiche un bouton de commentaire à côté du label (target_type = "script"). */
  commentId?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {commentId && (
          <CommentButton targetType="script" targetId={commentId} />
        )}
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
