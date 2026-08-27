"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Scissors,
  Bookmark,
  X,
  ImageIcon,
  Film,
  Camera,
  Smile,
  Move,
  Type,
  Pencil,
  Zap,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { StoryboardSegmentButton } from "@/components/ai-generator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { CommentButton } from "@/components/comments";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  addScene,
  deleteScene,
  updateScene,
  reorderScenes,
  addSceneFromPreset,
  createScenePreset,
  deleteScenePreset,
  upsertReelDetails,
} from "@/app/(app)/contents/actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import { FilmedProgress, computeFilmedStatus } from "./filmed-progress";
import Image from "next/image";
import { FilmingLayouts } from "@/components/equipment-layout-diagram";
import { ScenePresetEditDialog } from "@/components/scene-preset-edit-dialog";
import type {
  StoryboardScene,
  ScenePreset,
  FilmingGuide,
  ReelDetails,
  EquipmentPosition,
} from "@/lib/types";

const DRAG_MIME = "application/x-mohtawa-scene-id";

type SceneFormState = {
  id: string;
  description: string;
  camera_angle: string;
  on_screen_text: string;
  editing_notes: string;
  expression: string;
  movement: string;
};

const EMPTY_GUIDE: FilmingGuide = {
  lighting: "",
  camera_style: "",
  pacing: "",
  energy: "",
  tip: "",
};

export function StoryboardTab({
  contentId,
  scenes: initialScenes,
  scenePresets,
  brandId,
  filmingGuide: initialFilmingGuide,
  reel,
}: {
  contentId: string;
  scenes: StoryboardScene[];
  /** Setups réutilisables de la marque (Lot 2, migration 0021). */
  scenePresets: ScenePreset[];
  brandId: string;
  /** Résumé de tournage généré par l'IA (migration 0047), éditable ici. */
  filmingGuide: FilmingGuide | null;
  /** Pour le bouton "Découper en storyboard" — lit le script déjà enregistré. */
  reel: ReelDetails | null;
}) {
  const t = useTranslations("storyboard");
  const g = useTranslations("filmingGuide");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Script complet tel qu'enregistré (Guidé ou Libre), pour le découpage IA
  // en storyboard — on ne lit jamais le brouillon non sauvegardé de l'onglet
  // Script, seulement ce qui est en base.
  const fullScriptText = reel?.script_free_mode
    ? (reel.script_full ?? "")
    : [reel?.intro, reel?.script_full, reel?.outro]
        .filter((s): s is string => Boolean(s?.trim()))
        .join("\n\n");

  // L'état des champs texte de toutes les scènes (un seul Save pour tout).
  // Ordre + image_url restent gérés par le serveur (actions atomiques).
  // On hash le contenu texte des scènes pour que useMemo détecte les changements
  // serveur (après reorder, add, delete).
  const scenesHash = initialScenes
    .map(
      (s) =>
        `${s.id}:${s.description ?? ""}:${s.camera_angle ?? ""}:${s.on_screen_text ?? ""}:${s.editing_notes ?? ""}:${s.expression ?? ""}:${s.movement ?? ""}`,
    )
    .join("|");
  const guideHash = JSON.stringify(initialFilmingGuide ?? EMPTY_GUIDE);

  const initial = useMemo(
    () => ({
      scenes: initialScenes.map<SceneFormState>((s) => ({
        id: s.id,
        description: s.description ?? "",
        camera_angle: s.camera_angle ?? "",
        on_screen_text: s.on_screen_text ?? "",
        editing_notes: s.editing_notes ?? "",
        expression: s.expression ?? "",
        movement: s.movement ?? "",
      })),
      guide: initialFilmingGuide ?? EMPTY_GUIDE,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenesHash, guideHash],
  );

  const { state, setState, isDirty, isSaving, error, handleSave, handleReset } =
    useExplicitSave(initial, async (v) => {
      const ops = await Promise.all([
        ...v.scenes.map((scene) =>
          updateScene(
            scene.id,
            {
              description: scene.description,
              camera_angle: scene.camera_angle,
              on_screen_text: scene.on_screen_text,
              editing_notes: scene.editing_notes,
              expression: scene.expression,
              movement: scene.movement,
            },
            contentId,
          ),
        ),
        upsertReelDetails(contentId, { filming_guide: v.guide }),
      ]);
      const firstError = ops.find(
        (r) => r && typeof r === "object" && "error" in r && r.error,
      );
      return firstError ?? { ok: true };
    });

  const updateSceneField = (
    sceneId: string,
    key:
      | "description"
      | "camera_angle"
      | "on_screen_text"
      | "editing_notes"
      | "expression"
      | "movement",
    value: string,
  ) => {
    setState((s) => ({
      ...s,
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, [key]: value } : sc,
      ),
    }));
  };

  const updateGuideField = (key: keyof FilmingGuide, value: string) => {
    setState((s) => ({ ...s, guide: { ...s.guide, [key]: value } }));
  };

  /**
   * Corrige à la main la position d'un équipement proposée par l'IA (elle
   * peut se tromper — cf. la fenêtre placée à contre-jour). Passe par le
   * même formulaire que le reste : la modif part au Save global.
   */
  const updatePlacementPosition = (
    presetLabel: string,
    equipmentLabel: string,
    position: EquipmentPosition,
  ) => {
    setState((s) => ({
      ...s,
      guide: {
        ...s.guide,
        preset_layouts: (s.guide.preset_layouts ?? []).map((pl) =>
          pl.preset_label !== presetLabel
            ? pl
            : {
                ...pl,
                equipment_layout: pl.equipment_layout.map((it) =>
                  it.label === equipmentLabel ? { ...it, position } : it,
                ),
              },
        ),
      },
    }));
  };

  const updateCameraPosition = (position: EquipmentPosition) => {
    setState((s) => ({ ...s, guide: { ...s.guide, camera_position: position } }));
  };

  // Champs texte explicitement listés (pas Object.values) : "guide" porte
  // aussi camera_position/preset_layouts, pas des string — .trim() y planterait.
  const hasGuideContent = [
    state.guide.lighting,
    state.guide.camera_style,
    state.guide.pacing,
    state.guide.energy,
    state.guide.tip,
  ].some((v) => v.trim());

  /* ============== Drag & drop reorder (immédiat) ============== */
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const onDragStart = (idx: number, e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_MIME, String(idx));
  };

  const onDragOver = (idx: number, e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  };

  const onDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIdx(null);
    const fromIdx = Number(e.dataTransfer.getData(DRAG_MIME));
    setDragIdx(null);
    if (Number.isNaN(fromIdx) || fromIdx === idx) return;

    // Optimistic reorder côté client (on respecte l'ordre actuel de `state.scenes`)
    const next = [...state.scenes];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(idx, 0, moved);
    setState((s) => ({ ...s, scenes: next }));

    startTransition(async () => {
      await reorderScenes(
        contentId,
        next.map((s) => s.id),
      );
      router.refresh();
    });
  };

  /* ============== Setups réutilisables (Lot 2) ============== */
  const [createPresetOpen, setCreatePresetOpen] = useState(false);
  const [editPreset, setEditPreset] = useState<ScenePreset | null>(null);

  const insertFromPreset = (presetId: string) => {
    startTransition(async () => {
      await addSceneFromPreset({ contentId, presetId });
      router.refresh();
    });
  };

  const removePreset = (presetId: string) => {
    startTransition(async () => {
      await deleteScenePreset(presetId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilmedProgress
              {...computeFilmedStatus(initialScenes, undefined)}
              variant="scenes"
            />
            <StoryboardSegmentButton
              contentId={contentId}
              script={fullScriptText}
            />
            <Button
              size="sm"
              onClick={() =>
                startTransition(async () => {
                  await addScene(contentId);
                  router.refresh();
                })
              }
              disabled={pending}
            >
              <Plus className="size-4" />
              {t("addScene")}
            </Button>
          </div>
        </div>

        {/* Résumé de tournage — généré par l'IA en même temps que le
            storyboard (migration 0047), toujours modifiable ensuite. Masqué
            tant qu'il n'y a rien (ni généré, ni saisi à la main). */}
        {hasGuideContent && (
          <details
            open
            className="group/guide rounded-2xl border border-accent/30 bg-accent/5 p-3 [&[open]_.guide-caret]:rotate-180"
          >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
              <Film className="size-3.5 text-accent" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                {g("title")}
              </span>
              <ChevronDown className="guide-caret ms-auto size-4 text-accent/70 transition-transform" />
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <GuideField
                label={g("lighting")}
                value={state.guide.lighting}
                onChange={(v) => updateGuideField("lighting", v)}
              />
              <GuideField
                label={g("cameraStyle")}
                value={state.guide.camera_style}
                onChange={(v) => updateGuideField("camera_style", v)}
              />
              <GuideField
                label={g("pacing")}
                value={state.guide.pacing}
                onChange={(v) => updateGuideField("pacing", v)}
              />
              <GuideField
                label={g("energy")}
                value={state.guide.energy}
                onChange={(v) => updateGuideField("energy", v)}
              />
            </div>
            <div className="mt-2 space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {g("tip")}
              </Label>
              <Input
                className="h-8 text-xs"
                dir="auto"
                value={state.guide.tip}
                onChange={(e) => updateGuideField("tip", e.target.value)}
              />
            </div>

            <FilmingLayouts
              presetLayouts={state.guide.preset_layouts}
              cameraPosition={state.guide.camera_position}
              onChangePlacement={updatePlacementPosition}
              onChangeCamera={updateCameraPosition}
            />
          </details>
        )}

        {/* Barre de setups réutilisables : clique pour insérer une scène
            pré-remplie. La biblio se remplit en avance (dialog "Nouveau
            setup") ou au vol (bouton "enregistrer" sur une scène). */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"
            title={t("presetsHint")}
          >
            <Bookmark className="size-3.5" />
            {t("presets")}
          </span>
          {scenePresets.map((preset) => (
            <PresetChip
              key={preset.id}
              preset={preset}
              disabled={pending}
              onInsert={() => insertFromPreset(preset.id)}
              onDelete={() => removePreset(preset.id)}
              onEdit={() => setEditPreset(preset)}
            />
          ))}
          <button
            type="button"
            onClick={() => setCreatePresetOpen(true)}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent/60 hover:text-accent disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {t("newPreset")}
          </button>
        </div>

        <CreatePresetDialog
          open={createPresetOpen}
          onOpenChange={setCreatePresetOpen}
          brandId={brandId}
          contentId={contentId}
        />

        <ScenePresetEditDialog
          preset={editPreset}
          onOpenChange={(v) => !v && setEditPreset(null)}
        />

        {/* Table lumineuse : les plans sont posés sur un fond sombre plutôt
            que blanc sur blanc. Les visuels ressortent, et l'œil compte les
            cadres au lieu de lire des libellés. */}
        <div className="surface-board rounded-3xl p-4 sm:p-5">
          {state.scenes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/25 p-10 text-center">
              <p className="text-sm font-medium text-white">{t("emptyTitle")}</p>
              <p className="mt-1 text-xs text-white/60">
                {fullScriptText.trim() ? t("emptySubtitleWithScript") : t("emptySubtitle")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {state.scenes.map((sceneForm, idx) => {
              // Pour l'image, on lit toujours le state serveur (image_url
              // n'est pas dans le formulaire — c'est une action atomique).
              const serverScene = initialScenes.find(
                (s) => s.id === sceneForm.id,
              );
              return (
                <div
                  key={sceneForm.id}
                  draggable
                  onDragStart={(e) => onDragStart(idx, e)}
                  onDragOver={(e) => onDragOver(idx, e)}
                  onDragLeave={() => {
                    if (dragOverIdx === idx) setDragOverIdx(null);
                  }}
                  onDrop={(e) => onDrop(idx, e)}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setDragOverIdx(null);
                  }}
                  className={cn(
                    "transition-all",
                    dragIdx === idx && "opacity-40",
                    dragOverIdx === idx && dragIdx !== idx && "scale-[1.02]",
                  )}
                >
                  <SceneCard
                    sceneForm={sceneForm}
                    serverImageUrl={serverScene?.image_url ?? null}
                    serverFilmed={serverScene?.filmed ?? false}
                    index={idx}
                    contentId={contentId}
                    brandId={brandId}
                    onFieldChange={(key, value) =>
                      updateSceneField(sceneForm.id, key, value)
                    }
                  />
                </div>
              );
            })}
            </div>
          )}
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

/** Un champ court du résumé de tournage (éclairage, style caméra...). */
function GuideField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </Label>
      <Input
        className="h-8 text-xs"
        dir="auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SceneCard({
  sceneForm,
  serverImageUrl,
  serverFilmed,
  index,
  contentId,
  brandId,
  onFieldChange,
}: {
  sceneForm: SceneFormState;
  serverImageUrl: string | null;
  serverFilmed: boolean;
  index: number;
  contentId: string;
  brandId: string;
  onFieldChange: (
    key:
      | "description"
      | "camera_angle"
      | "on_screen_text"
      | "editing_notes"
      | "expression"
      | "movement",
    value: string,
  ) => void;
}) {
  const t = useTranslations("storyboard");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Lot 2 — "enregistrer comme setup" : on capture le cadrage + l'image
  // + les notes de montage de cette scène dans la bibliothèque de la marque.
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  // Optimistic filmed : on update visuel immédiat, on resync depuis serverFilmed
  // après router.refresh. Pas dans le form state car c'est une action atomique
  // (un clic = un save immédiat, comme l'upload image).
  const [optimisticFilmed, setOptimisticFilmed] = useState(serverFilmed);
  useEffect(() => {
    setOptimisticFilmed(serverFilmed);
  }, [serverFilmed]);

  // Les 5 champs secondaires (caméra, expression, mouvement, texte affiché,
  // montage) ne sont plus dépliés dans la carte : après un découpage IA ils
  // sont tous remplis, et 5 champs × 8 cartes = le mur de texte. Ils vivent
  // dans une fenêtre dédiée, et la carte n'en garde que des puces lisibles
  // d'un coup d'œil.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const chips = [
    { icon: Camera, value: sceneForm.camera_angle },
    { icon: Type, value: sceneForm.on_screen_text },
    { icon: Smile, value: sceneForm.expression },
    { icon: Move, value: sceneForm.movement },
    { icon: Scissors, value: sceneForm.editing_notes },
  ].filter((c) => c.value.trim());

  const onImageChange = (url: string | null) => {
    startTransition(async () => {
      await updateScene(sceneForm.id, { image_url: url }, contentId);
      router.refresh();
    });
  };

  const onToggleFilmed = () => {
    const next = !optimisticFilmed;
    setOptimisticFilmed(next);
    startTransition(async () => {
      const res = await updateScene(sceneForm.id, { filmed: next }, contentId);
      if (res && "error" in res && res.error) {
        // Revert si erreur serveur
        setOptimisticFilmed(!next);
      }
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        // Une carte = un cadre de film. Pas de boîtes imbriquées, pas de
        // libellés répétés : l'image porte la carte, le texte est une légende.
        "group/scene relative flex flex-col overflow-hidden rounded-2xl bg-card text-foreground shadow-soft ring-1 transition",
        optimisticFilmed
          ? "ring-2 ring-emerald-400/80"
          : "ring-black/5 hover:shadow-lift",
      )}
    >
      {/* ---------- Le cadre ---------- */}
      <div className="relative">
        <ImageUpload
          contentId={contentId}
          value={serverImageUrl}
          aspectRatio="video"
          onChange={onImageChange}
          label={t("visual")}
          hint={null}
          frameClassName={cn(
            "rounded-none border-x-0 border-t-0 border-b bg-secondary/50",
            serverImageUrl
              ? "border-solid border-border/40"
              : "border-dashed border-border/70",
          )}
        />

        {/* Numéro de plan façon clap — remplace la ligne "1 · PLAN 01". */}
        <span className="pointer-events-none absolute start-2 top-2 z-10 inline-flex h-6 items-center rounded-md bg-ink/85 px-2 text-[11px] font-bold tabular-nums tracking-wider text-white backdrop-blur-sm">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Case "Filmée" — posée sur l'image pour ne pas coûter une ligne de
            plus, mais TOUJOURS visible, libellé compris : au survol seulement,
            elle était introuvable, et sur mobile il n'y a pas de survol.
            Cercle vide = à tourner, pastille verte = fait. */}
        <button
          type="button"
          onClick={onToggleFilmed}
          disabled={pending}
          title={optimisticFilmed ? t("filmed") : t("markFilmed")}
          aria-label={optimisticFilmed ? t("filmed") : t("markFilmed")}
          aria-pressed={optimisticFilmed}
          className={cn(
            "absolute bottom-2 start-2 z-10 inline-flex h-7 items-center gap-1.5 rounded-full ps-1.5 pe-2.5 text-[11px] font-bold shadow-sm backdrop-blur-sm transition disabled:opacity-50",
            optimisticFilmed
              ? "bg-emerald-500 text-white"
              : "bg-ink/75 text-white/90 hover:bg-ink/90 hover:text-white",
          )}
        >
          {optimisticFilmed ? (
            <Check className="size-4 shrink-0" />
          ) : (
            <span className="size-3.5 shrink-0 rounded-full border-[1.5px] border-current" />
          )}
          {t("filmed")}
        </button>

        {/* Actions rares (setup, suppression) : masquées jusqu'au survol.
            Placées en bas à droite pour ne pas heurter la croix de l'upload. */}
        <div className="absolute bottom-2 end-2 z-10 flex items-center gap-0.5 rounded-full bg-ink/65 p-0.5 opacity-0 backdrop-blur-sm transition focus-within:opacity-100 group-hover/scene:opacity-100">
          {/* Poignée : la carte entière est déjà `draggable`, cette icône
              n'est là que pour dire qu'on peut réordonner. */}
          <span
            className="cursor-grab p-1.5 text-white/60 active:cursor-grabbing"
            title={t("reorderHint")}
          >
            <GripVertical className="size-3.5" />
          </span>
          <button
            type="button"
            onClick={() => setSavePresetOpen(true)}
            disabled={pending}
            className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Enregistrer cette scène comme setup réutilisable"
            title="Enregistrer comme setup réutilisable"
          >
            <Bookmark className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await deleteScene(sceneForm.id, contentId);
                router.refresh();
              })
            }
            disabled={pending}
            className="rounded-full p-1.5 text-white/80 transition hover:bg-red-500/80 hover:text-white"
            aria-label={t("deleteScene")}
            title={t("deleteScene")}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ---------- La légende ---------- */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Pas de label au-dessus : le champ EST la légende du cadre.
            L'exemple long n'est montré que sur le premier plan — au-delà,
            c'est le même texte répété autant de fois qu'il y a de cartes. */}
        <Textarea
          className="-mx-1.5 max-h-40 min-h-11 w-[calc(100%+0.75rem)] flex-1 resize-none overflow-y-auto rounded-lg border-transparent bg-transparent px-1.5 py-1 text-sm leading-relaxed shadow-none [field-sizing:content] focus-visible:bg-secondary/40"
          dir="auto"
          value={sceneForm.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          placeholder={
            index === 0
              ? t("fields.actionPlaceholder")
              : t("fields.actionShortPlaceholder")
          }
          aria-label={t("fields.action")}
        />

        <div className="flex items-end justify-between gap-2 pt-0.5">
          {chips.length > 0 ? (
            // Les détails remplis se lisent en puces tronquées ; un clic
            // ouvre la fenêtre pour les modifier en entier.
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-start"
              title={t("details")}
            >
              {chips.slice(0, 3).map((chip, i) => {
                const Icon = chip.icon;
                return (
                  <span
                    key={i}
                    className="inline-flex max-w-36 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted transition hover:bg-accent/10 hover:text-accent"
                  >
                    <Icon className="size-3 shrink-0" />
                    <span className="truncate" dir="auto">
                      {chip.value.trim()}
                    </span>
                  </span>
                );
              })}
              {chips.length > 3 && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted">
                  +{chips.length - 3}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted transition hover:bg-secondary hover:text-foreground"
            >
              <Plus className="size-3" />
              {t("details")}
            </button>
          )}
          <CommentButton
            targetType="scene"
            targetId={sceneForm.id}
            size="sm"
            className="shrink-0"
          />
        </div>
      </div>

      {/* Dialog "enregistrer comme setup" depuis cette scène */}
      <SavePresetDialog
        open={savePresetOpen}
        onOpenChange={setSavePresetOpen}
        brandId={brandId}
        prefill={{
          referenceImageUrl: serverImageUrl,
          defaultCamera: sceneForm.camera_angle,
          defaultEditingNotes: sceneForm.editing_notes,
        }}
      />

      <SceneDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        planLabel={t("detailsTitle", {
          n: String(index + 1).padStart(2, "0"),
        })}
        sceneForm={sceneForm}
        onFieldChange={onFieldChange}
      />
    </div>
  );
}

/**
 * Les 5 champs secondaires d'un plan, dans une fenêtre dédiée. Ils restent
 * pilotés par l'état du parent — fermer la fenêtre ne perd rien, c'est le
 * bouton « Enregistrer » du bas de page qui valide, comme pour le reste.
 */
function SceneDetailsDialog({
  open,
  onOpenChange,
  planLabel,
  sceneForm,
  onFieldChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planLabel: string;
  sceneForm: SceneFormState;
  onFieldChange: (
    key:
      | "description"
      | "camera_angle"
      | "on_screen_text"
      | "editing_notes"
      | "expression"
      | "movement",
    value: string,
  ) => void;
}) {
  const t = useTranslations("storyboard");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{planLabel}</DialogTitle>
          <DialogDescription>
            Tout est optionnel — remplis seulement ce qui t&apos;aide à tourner.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <DetailField
            icon={Camera}
            label={t("fields.camera")}
            value={sceneForm.camera_angle}
            placeholder={t("fields.cameraPlaceholder")}
            onChange={(v) => onFieldChange("camera_angle", v)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField
              icon={Smile}
              label={t("fields.expression")}
              value={sceneForm.expression}
              placeholder={t("fields.expressionPlaceholder")}
              onChange={(v) => onFieldChange("expression", v)}
            />
            <DetailField
              icon={Move}
              label={t("fields.movement")}
              value={sceneForm.movement}
              placeholder={t("fields.movementPlaceholder")}
              onChange={(v) => onFieldChange("movement", v)}
            />
          </div>
          <DetailField
            icon={Type}
            label={t("fields.onScreenText")}
            value={sceneForm.on_screen_text}
            placeholder={t("fields.onScreenTextPlaceholder")}
            onChange={(v) => onFieldChange("on_screen_text", v)}
          />
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <Scissors className="size-3" />
              {t("editingNotes")}
            </Label>
            <Textarea
              className="max-h-40 min-h-16 overflow-y-auto text-sm leading-relaxed [field-sizing:content]"
              dir="auto"
              value={sceneForm.editing_notes}
              onChange={(e) => onFieldChange("editing_notes", e.target.value)}
              placeholder={t("editingNotesPlaceholder")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Un champ court de la fenêtre détails (icône + libellé + input). */
function DetailField({
  icon: Icon,
  label,
  value,
  placeholder,
  onChange,
}: {
  icon: typeof Camera;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
        <Icon className="size-3" />
        {label}
      </Label>
      <Input
        className="text-sm"
        dir="auto"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}


/* ============================ Setups (Lot 2) ============================ */

/** Vignette cliquable d'un setup dans la barre. Hover → boutons éditer/supprimer. */
function PresetChip({
  preset,
  disabled,
  onInsert,
  onDelete,
  onEdit,
}: {
  preset: ScenePreset;
  disabled: boolean;
  onInsert: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onInsert}
        disabled={disabled}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-card py-1 pe-3 ps-1 text-xs font-semibold transition hover:border-accent/60 hover:bg-accent/5 disabled:opacity-50"
        title={`Ajouter une scène « ${preset.label} »`}
      >
        <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
          {preset.reference_image_url ? (
            <Image
              src={preset.reference_image_url}
              alt={preset.label}
              fill
              sizes="28px"
              className="object-cover"
            />
          ) : (
            <ImageIcon className="size-3.5 text-muted" />
          )}
        </span>
        {preset.label}
        {preset.equipment?.trim() && (
          <Zap className="size-3 shrink-0 text-accent" aria-label="Matériel renseigné" />
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        disabled={disabled}
        className="absolute -start-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-accent text-white group-hover:flex"
        aria-label={`Modifier le setup ${preset.label}`}
        title="Modifier ce setup (dont le matériel)"
      >
        <Pencil className="size-2.5" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={disabled}
        className="absolute -end-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"
        aria-label={`Supprimer le setup ${preset.label}`}
        title="Supprimer ce setup de la bibliothèque"
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}

/** Dialog de création d'un setup "en avance" (la vidéo n'est pas concernée). */
function CreatePresetDialog({
  open,
  onOpenChange,
  brandId,
  contentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  contentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [camera, setCamera] = useState("");
  const [equipment, setEquipment] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setCamera("");
    setEquipment("");
    setImageUrl(null);
    setError(null);
  };

  const submit = () => {
    if (!label.trim()) {
      setError("Donne un nom à ton setup (ex : Coin bureau).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createScenePreset({
        brandId,
        label,
        referenceImageUrl: imageUrl,
        defaultCamera: camera.trim() || null,
        equipment: equipment.trim() || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              <Bookmark className="size-5 text-accent" />
              Nouveau setup réutilisable
            </span>
          </DialogTitle>
          <DialogDescription>
            Un setup, c&apos;est un lieu/cadrage de tournage que tu réutilises
            (ex : « Coin bureau », « B-roll clavier »). Tu pourras l&apos;insérer
            en 1 clic dans n&apos;importe quel storyboard.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="preset-label">Nom du setup</Label>
            <Input
              id="preset-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex : Coin bureau, face caméra"
              autoFocus
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Cadrage par défaut (optionnel)
            </Label>
            <Input
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              placeholder="Ex : Plan large fixe, légèrement plongé"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              <Zap className="size-3" />
              Matériel à ce lieu (optionnel)
            </Label>
            <Input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Ex : anneau lumineux, trépied — laisse vide si aucun (ex : lumière naturelle)"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Photo de référence (optionnel)
            </Label>
            {/* On réutilise le bucket du content courant pour stocker l'image
                de réf du setup — simple, pas besoin d'un bucket dédié. */}
            <ImageUpload
              contentId={contentId}
              value={imageUrl}
              aspectRatio="video"
              onChange={setImageUrl}
              label="Ajouter une photo du lieu/cadrage"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !label.trim()}>
            {pending ? "Création…" : "Créer le setup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog "enregistrer cette scène comme setup" — pré-rempli depuis la scène. */
function SavePresetDialog({
  open,
  onOpenChange,
  brandId,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  prefill: {
    referenceImageUrl: string | null;
    defaultCamera: string;
    defaultEditingNotes: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [equipment, setEquipment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!label.trim()) {
      setError("Donne un nom à ce setup.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createScenePreset({
        brandId,
        label,
        referenceImageUrl: prefill.referenceImageUrl,
        defaultCamera: prefill.defaultCamera.trim() || null,
        defaultEditingNotes: prefill.defaultEditingNotes.trim() || null,
        equipment: equipment.trim() || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setLabel("");
      setEquipment("");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              <Bookmark className="size-5 text-accent" />
              Enregistrer comme setup
            </span>
          </DialogTitle>
          <DialogDescription>
            On garde l&apos;image, le cadrage et les notes de montage de cette
            scène dans ta bibliothèque. Tu pourras la réinsérer en 1 clic
            ailleurs.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="save-preset-label">Nom du setup</Label>
            <Input
              id="save-preset-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex : Coin bureau, face caméra"
              autoFocus
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              <Zap className="size-3" />
              Matériel à ce lieu (optionnel)
            </Label>
            <Input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Ex : anneau lumineux, trépied — laisse vide si aucun"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !label.trim()}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
