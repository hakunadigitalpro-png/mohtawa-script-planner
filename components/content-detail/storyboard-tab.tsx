"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
  Scissors,
  ChevronDown,
  Bookmark,
  X,
  ImageIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
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
} from "@/app/(app)/contents/actions";
import { aiGenerateSceneImage } from "@/app/(app)/contents/ai-actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import { FilmedProgress, computeFilmedStatus } from "./filmed-progress";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import type { StoryboardScene, ScenePreset } from "@/lib/types";

const DRAG_MIME = "application/x-mohtawa-scene-id";

type SceneFormState = {
  id: string;
  description: string;
  camera_angle: string;
  on_screen_text: string;
  editing_notes: string;
};

export function StoryboardTab({
  contentId,
  scenes: initialScenes,
  scenePresets,
  brandId,
}: {
  contentId: string;
  scenes: StoryboardScene[];
  /** Setups réutilisables de la marque (Lot 2, migration 0021). */
  scenePresets: ScenePreset[];
  brandId: string;
}) {
  const t = useTranslations("storyboard");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // L'état des champs texte de toutes les scènes (un seul Save pour tout).
  // Ordre + image_url restent gérés par le serveur (actions atomiques).
  // On hash le contenu texte des scènes pour que useMemo détecte les changements
  // serveur (après reorder, add, delete).
  const scenesHash = initialScenes
    .map(
      (s) =>
        `${s.id}:${s.description ?? ""}:${s.camera_angle ?? ""}:${s.on_screen_text ?? ""}:${s.editing_notes ?? ""}`,
    )
    .join("|");

  const initial = useMemo(
    () => ({
      scenes: initialScenes.map<SceneFormState>((s) => ({
        id: s.id,
        description: s.description ?? "",
        camera_angle: s.camera_angle ?? "",
        on_screen_text: s.on_screen_text ?? "",
        editing_notes: s.editing_notes ?? "",
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenesHash],
  );

  const { state, setState, isDirty, isSaving, handleSave, handleReset } =
    useExplicitSave(initial, async (v) => {
      const ops = await Promise.all(
        v.scenes.map((scene) =>
          updateScene(
            scene.id,
            {
              description: scene.description,
              camera_angle: scene.camera_angle,
              on_screen_text: scene.on_screen_text,
              editing_notes: scene.editing_notes,
            },
            contentId,
          ),
        ),
      );
      const firstError = ops.find(
        (r) => r && typeof r === "object" && "error" in r && r.error,
      );
      return firstError ?? { ok: true };
    });

  const updateSceneField = (
    sceneId: string,
    key: "description" | "camera_angle" | "on_screen_text" | "editing_notes",
    value: string,
  ) => {
    setState((s) => ({
      ...s,
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, [key]: value } : sc,
      ),
    }));
  };

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
          <div className="flex items-center gap-3">
            <FilmedProgress
              {...computeFilmedStatus(initialScenes, undefined)}
              variant="scenes"
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

        {/* Barre de setups réutilisables : clique pour insérer une scène
            pré-remplie. La biblio se remplit en avance (dialog "Nouveau
            setup") ou au vol (bouton "enregistrer" sur une scène). */}
        <div className="rounded-2xl border border-border/50 bg-secondary/20 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Bookmark className="size-3.5 text-muted" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Mes setups
            </span>
            <span className="text-[10px] text-muted">
              · clique pour ajouter une scène pré-remplie
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scenePresets.map((preset) => (
              <PresetChip
                key={preset.id}
                preset={preset}
                disabled={pending}
                onInsert={() => insertFromPreset(preset.id)}
                onDelete={() => removePreset(preset.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => setCreatePresetOpen(true)}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-border/60 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent/60 hover:text-accent disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Nouveau setup
            </button>
          </div>
        </div>

        <CreatePresetDialog
          open={createPresetOpen}
          onOpenChange={setCreatePresetOpen}
          brandId={brandId}
          contentId={contentId}
        />

        {state.scenes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("emptySubtitle")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
    key: "description" | "camera_angle" | "on_screen_text" | "editing_notes",
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

  // Lot 1 — réduction des champs : on ne montre par défaut que Image +
  // Action/Dialogue. Caméra, Texte affiché et Montage sont repliés derrière
  // "+ détails". On ouvre automatiquement si un de ces champs a déjà du
  // contenu (re-édition d'une scène existante → on ne cache jamais du texte).
  const hasDetailsContent = Boolean(
    sceneForm.camera_angle.trim() ||
      sceneForm.on_screen_text.trim() ||
      sceneForm.editing_notes.trim(),
  );
  const [detailsOpen, setDetailsOpen] = useState(hasDetailsContent);

  const onImageChange = (url: string | null) => {
    startTransition(async () => {
      await updateScene(sceneForm.id, { image_url: url }, contentId);
      router.refresh();
    });
  };

  // -------- AI image generation (Idée 2) --------
  // Click sur "Générer image IA" → ouvre un dialog où l'user tape sa
  // description de sketch (placement caméra, blocking, intention de
  // shooting). On envoie CE texte à DALL-E, pas les champs Action/etc.
  // Avantages :
  //  - L'user a un contrôle total sur le prompt (pas de surprise)
  //  - Évite le piège du "texte tapé mais pas sauvé en DB"
  //  - Permet de réfléchir au sketch sans toucher au descriptif viewer
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPromptText, setAiPromptText] = useState("");
  const [aiCameraNote, setAiCameraNote] = useState("");

  const openAiDialog = () => {
    // Pré-remplit avec la description actuelle comme point de départ
    // (l'user peut éditer / enrichir pour préciser le shooting).
    setAiPromptText(sceneForm.description.trim() || "");
    setAiCameraNote(sceneForm.camera_angle.trim() || "");
    setAiError(null);
    setAiDialogOpen(true);
  };

  const generateAiImage = () => {
    if (!aiPromptText.trim()) {
      setAiError("Tape une description avant de générer.");
      return;
    }
    setAiError(null);
    setAiPending(true);
    startTransition(async () => {
      const res = await aiGenerateSceneImage({
        sceneId: sceneForm.id,
        contentId,
        description: aiPromptText.trim(),
        cameraNote: aiCameraNote.trim() || undefined,
      });
      setAiPending(false);
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      setAiDialogOpen(false);
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
        "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all",
        optimisticFilmed
          ? "border-emerald-300/60 opacity-90"
          : "border-border/60",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-3 py-2",
          optimisticFilmed
            ? "border-emerald-300/40 bg-emerald-50/40"
            : "border-border/60 bg-secondary/50",
        )}
      >
        <div className="flex items-center gap-1.5">
          <GripVertical className="size-3.5 cursor-grab text-muted active:cursor-grabbing" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            {t("planNumber", { n: String(index + 1).padStart(2, "0") })}
          </span>
          {optimisticFilmed && (
            <span className="ms-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              {t("filmedBadge")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <CommentButton targetType="scene" targetId={sceneForm.id} size="sm" />
          <button
            type="button"
            onClick={() => setSavePresetOpen(true)}
            disabled={pending}
            className="rounded-full p-1 text-muted hover:bg-accent/10 hover:text-accent"
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
            className="rounded-full p-1 text-muted hover:bg-destructive/10 hover:text-destructive"
            aria-label={t("deleteScene")}
          >
            <Trash2 className="size-3.5" />
          </button>
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

      <div className="space-y-2 p-2.5">
        <ImageUpload
          contentId={contentId}
          value={serverImageUrl}
          aspectRatio="video"
          onChange={onImageChange}
          label={t("fields.action")}
        />

        {/* Bouton de génération d'image IA → ouvre un dialog où l'user
            tape sa description de sketch dédiée (placement caméra, etc.) */}
        <button
          type="button"
          onClick={openAiDialog}
          disabled={pending}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-xl",
            "border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent transition",
            "hover:bg-accent/15",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Sparkles className="size-3" />
          {serverImageUrl ? "Régénérer avec l'IA" : "Générer une image IA"}
        </button>

        {/* Dialog de génération IA */}
        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="size-5 text-accent" />
                  Générer un sketch IA
                </span>
              </DialogTitle>
              <DialogDescription>
                Décris en détail comment tu veux que cette scène apparaisse
                pour le shooting. Cadrage, placement caméra, action, ambiance —
                plus tu es précise, plus l&apos;image colle à ton intention.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Description du sketch
                </Label>
                <Textarea
                  className="min-h-28 text-sm [field-sizing:content]"
                  value={aiPromptText}
                  onChange={(e) => setAiPromptText(e.target.value)}
                  placeholder="Ex : Une femme en chemise blanche marche dans un open space lumineux, regarde son téléphone en souriant. Lumière naturelle, plan large vu de face."
                  autoFocus
                  disabled={aiPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Placement caméra (optionnel)
                </Label>
                <Input
                  className="h-9 text-sm"
                  value={aiCameraNote}
                  onChange={(e) => setAiCameraNote(e.target.value)}
                  placeholder="Ex : Plan large, caméra à hauteur des yeux, légèrement de gauche"
                  disabled={aiPending}
                />
                <p className="text-[10px] text-muted">
                  Précise l&apos;angle ou la distance si tu prépares ton
                  tournage. Vide = DALL-E choisit le cadrage.
                </p>
              </div>
              {aiError && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {aiError}
                </p>
              )}
              {aiPending && (
                <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
                  Génération en cours… (~10s)
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAiDialogOpen(false)}
                disabled={aiPending}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={generateAiImage}
                disabled={aiPending || !aiPromptText.trim()}
              >
                <Sparkles
                  className={cn("size-4", aiPending && "animate-pulse")}
                />
                {aiPending ? "Génération…" : "Générer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("fields.action")}
          </Label>
          <Textarea
            // max-h + scroll : le champ grandit avec le texte jusqu'à un
            // plafond puis défile → cartes régulières (plus de murs de texte).
            // dir="auto" : aligne le texte selon la langue (arabe RTL / FR LTR).
            className="max-h-56 min-h-12 overflow-y-auto text-sm leading-relaxed [field-sizing:content]"
            dir="auto"
            value={sceneForm.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
            placeholder={t("fields.actionPlaceholder")}
          />
        </div>

        {/* Champs avancés repliables (Lot 1). Cachés par défaut pour
            désencombrer ; bouton "+ détails" pour les révéler. */}
        {!detailsOpen ? (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border/60 py-1 text-[11px] font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
          >
            <Plus className="size-3" />
            Caméra, texte affiché, montage
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-border/40 bg-secondary/20 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Détails
              </span>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="inline-flex items-center gap-0.5 text-[10px] text-muted hover:text-foreground"
                aria-label="Réduire les détails"
              >
                Réduire
                <ChevronDown className="size-3 rotate-180" />
              </button>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {t("fields.camera")}
              </Label>
              <Input
                className="h-8 text-xs"
                dir="auto"
                value={sceneForm.camera_angle}
                onChange={(e) => onFieldChange("camera_angle", e.target.value)}
                placeholder={t("fields.cameraPlaceholder")}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {t("fields.onScreenText")}
              </Label>
              <Input
                className="h-8 text-xs"
                dir="auto"
                value={sceneForm.on_screen_text}
                onChange={(e) =>
                  onFieldChange("on_screen_text", e.target.value)
                }
                placeholder={t("fields.onScreenTextPlaceholder")}
              />
            </div>

            {/* Remarques de montage (Idée 3) — filtres, effets, transitions,
                musique, sound design. Champ libre par scène. */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <Scissors className="size-3" />
                Montage / Post-prod
              </Label>
              <Textarea
                className="max-h-32 min-h-10 overflow-y-auto text-sm leading-relaxed [field-sizing:content]"
                dir="auto"
                value={sceneForm.editing_notes}
                onChange={(e) => onFieldChange("editing_notes", e.target.value)}
                placeholder="Ex : Filtre vintage, cut net vers Plan 04, whoosh-sound."
              />
            </div>
          </div>
        )}

        {/* Toggle "Filmé" — atomic action (clic = save immédiat). */}
        <label
          className={cn(
            "mt-1 flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1.5 transition",
            optimisticFilmed
              ? "border-emerald-300/60 bg-emerald-50/60"
              : "border-border/60 bg-secondary/30 hover:bg-secondary/60",
            pending && "opacity-60",
          )}
        >
          <Checkbox
            checked={optimisticFilmed}
            onCheckedChange={onToggleFilmed}
            disabled={pending}
          />
          <span
            className={cn(
              "text-xs font-semibold",
              optimisticFilmed ? "text-emerald-700" : "text-foreground",
            )}
          >
            {t("filmed")}
          </span>
        </label>
      </div>
    </div>
  );
}

/* ============================ Setups (Lot 2) ============================ */

/** Vignette cliquable d'un setup dans la barre. Hover → bouton supprimer. */
function PresetChip({
  preset,
  disabled,
  onInsert,
  onDelete,
}: {
  preset: ScenePreset;
  disabled: boolean;
  onInsert: () => void;
  onDelete: () => void;
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
              unoptimized
            />
          ) : (
            <ImageIcon className="size-3.5 text-muted" />
          )}
        </span>
        {preset.label}
      </button>
      <button
        type="button"
        onClick={onDelete}
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setCamera("");
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
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setLabel("");
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
