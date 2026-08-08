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
import { HooksPickerButton } from "@/components/hooks-picker";
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
// ReferenceAnalyzer (transcription d'une vidéo de référence) parké — voir
// WISHLIST.md. Import + rendu retirés ; le composant reste dans le repo.
import { FilmedProgress, computeFilmedStatus } from "./filmed-progress";
import { Checkbox } from "@/components/ui/checkbox";
import type { Content, ReelDetails, StoryDetails, StorySlide } from "@/lib/types";

const SLIDE_DRAG_MIME = "application/x-mohtawa-slot-number";

export function ScriptTab({
  content,
  reel,
  story,
  slides,
  brandAudience,
}: {
  content: Content;
  reel: ReelDetails | null;
  story: StoryDetails | null;
  slides: StorySlide[];
  brandAudience: string | null;
}) {
  if (content.type === "story") {
    return (
      <StoryScript
        contentId={content.id}
        story={story}
        slides={slides}
        title={content.title}
        brandAudience={brandAudience}
      />
    );
  }
  return (
    <ReelScript
      contentId={content.id}
      content={content}
      reel={reel}
      brandAudience={brandAudience}
    />
  );
}

/* ============================== REEL ============================== */

/**
 * Script volontairement SIMPLE : 3 blocs seulement — Accroche / Corps /
 * Outro. (Choix produit : le plus simple possible pour l'utilisateur.)
 *
 *  - Accroche → reel_details.intro
 *  - Corps    → reel_details.script_full
 *  - Outro    → reel_details.outro
 *
 * Les colonnes détaillées (point1-3, transition, recap) restent en base
 * mais ne sont plus affichées ; leur contenu existant a été replié dans
 * "Corps" par la migration 0026. Le placeholder de chaque bloc est un
 * exemple concret. Estimation de durée globale en header (~4 mots/sec FR).
 */
const REEL_BLOCKS = [
  {
    key: "intro",
    label: "Accroche",
    timing: "~5-10s",
    placeholder:
      "Ex : Voici les 3 erreurs qui tuent ton compte Instagram. La 2e va te surprendre.",
    big: false,
    // Trames cliquables : la personne complète les [trous].
    suggestions: [
      { label: "L'erreur classique", template: "L'erreur que presque tout le monde fait avec [ton sujet]…" },
      { label: "3 choses", template: "3 choses que personne ne te dit sur [ton sujet]." },
      { label: "Arrête de…", template: "Arrête de [ce qu'ils font] si tu veux [le résultat]." },
      { label: "Comment… sans…", template: "Comment [résultat] en [temps], sans [la contrainte]." },
    ],
  },
  {
    key: "script_full",
    label: "Corps",
    timing: "~30-45s",
    placeholder:
      "Le cœur de ta vidéo : développe ton idée dans l'ordre où tu veux la dire.",
    big: true,
    suggestions: [
      { label: "3 points", template: "1. [Premier point]\n2. [Deuxième point]\n3. [Troisième point]" },
      { label: "Problème → Solution", template: "Le problème : [décris-le]\nPourquoi ça arrive : [la cause]\nLa solution : [ce qu'il faut faire]" },
      { label: "Avant / Après", template: "Avant : [la situation de départ]\nCe que j'ai changé : [l'action]\nAprès : [le résultat]" },
      { label: "Mini-histoire", template: "Le contexte : [plante le décor]\nLe déclic : [ce qui a changé]\nLa leçon : [ce que ça t'apprend]" },
    ],
  },
  {
    key: "outro",
    label: "Outro",
    timing: "~5-10s",
    placeholder:
      "Ex : Sauvegarde ce Reel pour t'en souvenir. Dis-moi en commentaire ton #1.",
    big: false,
    suggestions: [
      { label: "Sauvegarde", template: "Sauvegarde ce Reel pour t'en souvenir." },
      { label: "Commente", template: "Dis-moi en commentaire [ta question]." },
      { label: "DM", template: "Envoie-moi « [MOT] » en DM pour [ta ressource]." },
      { label: "Abonne-toi", template: "Abonne-toi pour [le bénéfice]." },
    ],
  },
] as const;

type ReelBlockKey = (typeof REEL_BLOCKS)[number]["key"];

function ReelScript({
  contentId,
  content,
  reel,
  brandAudience,
}: {
  contentId: string;
  content: Content;
  reel: ReelDetails | null;
  brandAudience: string | null;
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

  const { state, setState, isDirty, isSaving, error, handleSave, handleReset } =
    useExplicitSave(initial, async (v) => upsertReelDetails(contentId, v));

  // Mode d'écriture : guidé (Accroche/Corps/Outro) ou libre (un seul bloc).
  // Persisté immédiatement (atomique), hors du Save du formulaire texte.
  const [freeMode, setFreeMode] = useState(reel?.script_free_mode ?? false);
  const [, startWrite] = useTransition();
  const setMode = (next: boolean) => {
    setFreeMode(next);
    startWrite(async () => {
      await upsertReelDetails(contentId, { script_free_mode: next });
    });
  };

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
              Accroche · Corps · Outro ·{" "}
              <span className={cn("font-semibold", durationColor)}>
                Estimé : {estimatedSeconds}s / 60s
              </span>
            </p>
          </div>
          <AiGeneratorButton
            contentId={contentId}
            type="reel"
            defaultTopic={content.title ?? undefined}
            defaultAudience={brandAudience ?? undefined}
            platform={content.platform ?? undefined}
          />
        </div>

        {/* Switch Guidé / Libre */}
        <div className="inline-flex rounded-full border border-border bg-secondary/40 p-0.5 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode(false)}
            className={cn(
              "rounded-full px-4 py-1.5 transition",
              !freeMode ? "bg-card text-foreground shadow-sm" : "text-muted",
            )}
          >
            Guidé
          </button>
          <button
            type="button"
            onClick={() => setMode(true)}
            className={cn(
              "rounded-full px-4 py-1.5 transition",
              freeMode ? "bg-card text-foreground shadow-sm" : "text-muted",
            )}
          >
            Libre
          </button>
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

        {freeMode ? (
          /* Mode LIBRE : un seul bloc, écris comme tu veux (= script_full). */
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Ton script
              </Label>
              <CommentButton targetType="script" targetId="script_full" />
            </div>
            <Textarea
              dir="auto"
              value={state.script_full}
              onChange={(e) =>
                setState((s) => ({ ...s, script_full: e.target.value }))
              }
              placeholder="Écris ton script comme tu veux, d'un seul bloc."
              className="min-h-64 text-sm leading-relaxed [field-sizing:content]"
            />
          </div>
        ) : (
          /* Mode GUIDÉ : 3 blocs Accroche / Corps / Outro */
          REEL_BLOCKS.map((block) => (
            <CompactField
              key={block.key}
              blockKey={block.key}
              label={block.label}
              timing={block.timing}
              placeholder={block.placeholder}
              big={block.big}
              value={state[block.key as keyof typeof state] as string}
              onChange={(v) => setState((s) => ({ ...s, [block.key]: v }))}
              suggestions={block.suggestions}
              // Sur l'Accroche : bouton "Choisir une accroche" (biblio de hooks).
              headerExtra={
                block.key === "intro" ? (
                  <HooksPickerButton
                    onPick={(text) =>
                      setState((s) => ({ ...s, intro: text }))
                    }
                  />
                ) : undefined
              }
            />
          ))
        )}
      </Card>

      <SaveFooter
        isDirty={isDirty}
        isSaving={isSaving}
        error={error}
        onSave={handleSave}
        onReset={handleReset}
      />
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
  headerExtra,
  big = false,
  suggestions,
}: {
  blockKey: ReelBlockKey;
  label: string;
  timing: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  /** Élément optionnel rendu à droite de l'en-tête du bloc (ex: bouton "Choisir une accroche" pour l'Accroche). */
  headerExtra?: React.ReactNode;
  /** Champ principal (Corps) → hauteur de départ plus grande. */
  big?: boolean;
  /** Trames cliquables : insèrent une structure à compléter dans le bloc. */
  suggestions?: readonly { label: string; template: string }[];
}) {
  // Compte de mots local pour feedback de durée sur le bloc (~4 mots/sec)
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  const blockSeconds = Math.round(wordCount / 4);

  // Insère une trame : remplit si le champ est vide, sinon ajoute à la suite.
  const insert = (tpl: string) =>
    onChange(value.trim() ? `${value}\n${tpl}` : tpl);

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
        <div className="flex items-center gap-2">
          {headerExtra}
          {wordCount > 0 && (
            <span className="text-[10px] text-muted">
              {wordCount} mots · ~{blockSeconds}s
            </span>
          )}
        </div>
      </div>
      <Textarea
        id={blockKey}
        dir="auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          // "Corps" démarre plus grand ; les autres petits puis auto-resize.
          big ? "min-h-32" : "min-h-12",
          "text-sm leading-relaxed [field-sizing:content]",
        )}
      />

      {/* Trames cliquables : pour ne jamais rester devant une case vide. */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-muted">
            💡 Trames :
          </span>
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => insert(s.template)}
              className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== STORY ============================== */

function StoryScript({
  contentId,
  story,
  slides: initialSlides,
  title,
  brandAudience,
}: {
  contentId: string;
  story: StoryDetails | null;
  slides: StorySlide[];
  title: string | null;
  brandAudience: string | null;
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

  const { state, setState, isDirty, isSaving, error, handleSave, handleReset } =
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
            <AiGeneratorButton
              contentId={contentId}
              type="story"
              defaultTopic={title ?? undefined}
              defaultAudience={brandAudience ?? undefined}
            />
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
        error={error}
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

