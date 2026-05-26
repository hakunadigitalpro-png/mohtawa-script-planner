"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { AiGeneratorButton } from "@/components/ai-generator";
import { CommentButton } from "@/components/comments";
import { ScriptHelp } from "@/components/field-help/script-help";
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
import { FilmedProgress, computeFilmedStatus } from "./filmed-progress";
import { Checkbox } from "@/components/ui/checkbox";
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
  return <ReelScript contentId={content.id} content={content} reel={reel} />;
}

/* ============================== REEL ============================== */

/**
 * Structure pédagogique d'un Reel : 3 phases × 7 blocs. La fiche est
 * toujours rendue intégralement (garde la valeur de coaching) mais
 * compactée visuellement :
 *  - Phase dividers fins (1 ligne) qui regroupent les blocs en
 *    Ouverture / Développement / Clôture.
 *  - Chaque bloc rendu avec un label + timing + textarea auto-resize
 *    (min ~48px quand vide, grandit avec le contenu).
 *  - Le placeholder du textarea est un EXEMPLE concret pour expliquer
 *    en pratique à quoi sert le bloc (au lieu d'un sous-titre abstrait).
 *  - Rappel du Hook (depuis Plan) en lecture seule au début pour que
 *    la créatrice rédige l'Intro en cohérence avec son hook.
 *  - Estimation de durée globale en header (4 mots/sec en FR parlé).
 */
const REEL_BLOCKS = [
  // Ouverture
  {
    key: "intro",
    label: "Intro",
    timing: "~5-10s",
    placeholder:
      "Ex : Voici les 3 erreurs qui tuent ton compte Instagram. La 2e va te surprendre.",
    phase: "ouverture",
  },
  // Développement
  {
    key: "point1",
    label: "Point 1",
    timing: "~10s",
    placeholder:
      "Ex : Erreur #1 — Tu publies sans calendrier. Résultat : tu posts quand l'inspiration vient = jamais.",
    phase: "developpement",
  },
  {
    key: "point2",
    label: "Point 2",
    timing: "~10s",
    placeholder:
      "Ex : Erreur #2 — Tu copies les autres au lieu de trouver ta voix unique.",
    phase: "developpement",
  },
  {
    key: "point3",
    label: "Point 3",
    timing: "~10s",
    placeholder:
      "Ex : Erreur #3 — Tu mesures les likes au lieu des sauvegardes.",
    phase: "developpement",
  },
  {
    key: "transition",
    label: "Transition / B-roll",
    timing: "~2-3s × N",
    placeholder:
      "Ex : Plan d'ouverture sur le téléphone, B-roll bureau, capture d'écran Insights.",
    phase: "developpement",
  },
  // Clôture
  {
    key: "recap",
    label: "Récap",
    timing: "~5s",
    placeholder:
      "Ex : Calendrier + voix unique + bonne métrique = compte qui grandit.",
    phase: "cloture",
  },
  {
    key: "outro",
    label: "Outro",
    timing: "~5-10s",
    placeholder:
      "Ex : Sauvegarde ce Reel pour t'en souvenir. Dis-moi en commentaire ton #1.",
    phase: "cloture",
  },
] as const;

type ReelBlockKey = (typeof REEL_BLOCKS)[number]["key"];

const PHASES = [
  { id: "ouverture", icon: "🎬", label: "Ouverture", timing: "10-15s" },
  { id: "developpement", icon: "💡", label: "Développement", timing: "30-45s" },
  { id: "cloture", icon: "🎯", label: "Clôture", timing: "10-15s" },
] as const;

function ReelScript({
  contentId,
  content,
  reel,
}: {
  contentId: string;
  content: Content;
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

  // Estimation de durée : ~4 mots/sec en FR parlé. On somme les mots des
  // 7 blocs. Donne un feedback visuel sur la longueur (cible 30-75s pour
  // un Reel qui performe).
  const estimatedSeconds = useMemo(() => {
    const totalWords = REEL_BLOCKS.map(
      (b) => state[b.key as keyof typeof state] as string,
    )
      .map((s) => s.trim().split(/\s+/).filter(Boolean).length)
      .reduce((a, b) => a + b, 0);
    return Math.round(totalWords / 4);
  }, [state]);

  const durationColor =
    estimatedSeconds === 0
      ? "text-muted"
      : estimatedSeconds >= 30 && estimatedSeconds <= 75
        ? "text-emerald-700"
        : "text-amber-600";

  // Groupe les blocs par phase pour le rendu
  const blocksByPhase = useMemo(() => {
    const map: Record<string, typeof REEL_BLOCKS[number][]> = {};
    for (const b of REEL_BLOCKS) {
      (map[b.phase] ??= []).push(b);
    }
    return map;
  }, []);

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        {/* Header : titre + estimation durée + bouton IA */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold">{t("title")}</h2>
              <ScriptHelp />
            </div>
            <p className="text-xs text-muted">
              {t("subtitle")} ·{" "}
              <span className={cn("font-semibold", durationColor)}>
                Estimé : {estimatedSeconds}s / 60s
              </span>
            </p>
          </div>
          <AiGeneratorButton contentId={contentId} type="reel" />
        </div>

        {/* Rappel du Hook (read-only, depuis Plan) */}
        {content.hook && (
          <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Hook (depuis le Plan)
            </div>
            <p className="mt-0.5 text-sm italic text-foreground/80">
              « {content.hook} »
            </p>
          </div>
        )}

        {/* Les 3 phases */}
        {PHASES.map((phase) => (
          <div key={phase.id} className="space-y-2.5">
            <PhaseDivider
              icon={phase.icon}
              label={phase.label}
              timing={phase.timing}
            />
            {blocksByPhase[phase.id]?.map((block) => (
              <CompactField
                key={block.key}
                blockKey={block.key}
                label={block.label}
                timing={block.timing}
                placeholder={block.placeholder}
                value={state[block.key as keyof typeof state] as string}
                onChange={(v) =>
                  setState((s) => ({ ...s, [block.key]: v }))
                }
              />
            ))}
          </div>
        ))}

        {/* Script complet (optionnel, séparé visuellement) */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="script_full">{t("fullScript")}</Label>
            <CommentButton targetType="script" targetId="script_full" />
          </div>
          <Textarea
            id="script_full"
            className="min-h-32"
            value={state.script_full}
            onChange={(e) =>
              setState((s) => ({ ...s, script_full: e.target.value }))
            }
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

/** Divider fin (1 ligne) pour annoncer une phase (Ouverture / etc.). */
function PhaseDivider({
  icon,
  label,
  timing,
}: {
  icon: string;
  label: string;
  timing: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-sm">{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/80">
        {label}
      </span>
      <span className="text-[10px] font-medium text-muted">· {timing}</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

/**
 * Bloc de script compact : label + timing + textarea auto-resize qui
 * commence petit (48px) et grandit avec le contenu (`field-sizing: content`).
 * Le placeholder est un VRAI exemple concret pour expliquer à quoi sert le
 * bloc en pratique (pédagogie sans sub-headline qui prend de la place).
 */
function CompactField({
  blockKey,
  label,
  timing,
  placeholder,
  value,
  onChange,
}: {
  blockKey: ReelBlockKey;
  label: string;
  timing: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Compte de mots local pour feedback de durée sur le bloc (~4 mots/sec)
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  const blockSeconds = Math.round(wordCount / 4);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Label
            htmlFor={blockKey}
            className="text-xs font-semibold text-foreground"
          >
            {label}
          </Label>
          <span className="text-[10px] font-medium text-muted">· {timing}</span>
          <CommentButton targetType="script" targetId={blockKey} />
        </div>
        {wordCount > 0 && (
          <span className="text-[10px] text-muted">
            {wordCount} mots · ~{blockSeconds}s
          </span>
        )}
      </div>
      <Textarea
        id={blockKey}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          // min-h plus petit que le default (96px) pour éviter le scroll
          "min-h-12 text-sm",
          // auto-resize sur navigateurs modernes (Chrome 123+, Safari 17.5+)
          "[field-sizing:content]",
        )}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <FilmedProgress
              {...computeFilmedStatus(undefined, initialSlides)}
              variant="stories"
            />
            <AiGeneratorButton contentId={contentId} type="story" />
          </div>
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
                  serverFilmed={slide?.filmed ?? false}
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
                  onToggleFilmed={(next) => {
                    // Toggle filmed = action atomique
                    startTransition(async () => {
                      await upsertStorySlide(contentId, slot, {
                        filmed: next,
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
  serverFilmed,
  onBodyChange,
  onImageChange,
  onToggleFilmed,
  onDragHandleStart,
  onDragHandleEnd,
}: {
  contentId: string;
  slotNumber: number;
  body: string;
  imageUrl: string | null;
  serverFilmed: boolean;
  onBodyChange: (v: string) => void;
  onImageChange: (url: string | null) => void;
  onToggleFilmed: (next: boolean) => void;
  onDragHandleStart?: (e: React.DragEvent) => void;
  onDragHandleEnd?: () => void;
}) {
  const t = useTranslations("stories");

  // Optimistic state pour le toggle "filmé" (un clic = visuel immédiat).
  const [optimisticFilmed, setOptimisticFilmed] = useState(serverFilmed);
  useEffect(() => {
    setOptimisticFilmed(serverFilmed);
  }, [serverFilmed]);

  const handleToggle = () => {
    const next = !optimisticFilmed;
    setOptimisticFilmed(next);
    onToggleFilmed(next);
  };

  const label =
    slotNumber === 1
      ? t("slotLabels.title")
      : slotNumber === 5
        ? t("slotLabels.cta")
        : STORY_SLOT_LABELS[slotNumber] ??
          t("slotLabels.default", { n: slotNumber });

  return (
    <div
      className={cn(
        "flex flex-col items-center transition-all",
        optimisticFilmed && "opacity-90",
      )}
    >
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
          {optimisticFilmed && (
            <span className="ms-1 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
              {t("filmedBadge")}
            </span>
          )}
        </div>
        <CommentButton
          targetType="slide"
          targetId={String(slotNumber)}
          size="sm"
        />
      </div>

      {/* Phone frame */}
      <div
        className={cn(
          "w-full overflow-hidden rounded-[20px] border-4 bg-card shadow-sm transition-colors",
          optimisticFilmed
            ? "border-emerald-500/80"
            : "border-foreground/80",
        )}
      >
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

      {/* Toggle "Filmé" — atomic action */}
      <label
        className={cn(
          "mt-1.5 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 transition",
          optimisticFilmed
            ? "border-emerald-300/60 bg-emerald-50/60"
            : "border-border/60 bg-secondary/30 hover:bg-secondary/60",
        )}
      >
        <Checkbox
          checked={optimisticFilmed}
          onCheckedChange={handleToggle}
        />
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            optimisticFilmed ? "text-emerald-700" : "text-muted",
          )}
        >
          {t("filmed")}
        </span>
      </label>
    </div>
  );
}

