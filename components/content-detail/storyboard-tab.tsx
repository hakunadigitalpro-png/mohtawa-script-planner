"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, GripVertical, Sparkles, Scissors } from "lucide-react";
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
} from "@/app/(app)/contents/actions";
import { aiGenerateSceneImage } from "@/app/(app)/contents/ai-actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import { FilmedProgress, computeFilmedStatus } from "./filmed-progress";
import { Checkbox } from "@/components/ui/checkbox";
import type { StoryboardScene } from "@/lib/types";

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
}: {
  contentId: string;
  scenes: StoryboardScene[];
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
  onFieldChange,
}: {
  sceneForm: SceneFormState;
  serverImageUrl: string | null;
  serverFilmed: boolean;
  index: number;
  contentId: string;
  onFieldChange: (
    key: "description" | "camera_angle" | "on_screen_text" | "editing_notes",
    value: string,
  ) => void;
}) {
  const t = useTranslations("storyboard");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Optimistic filmed : on update visuel immédiat, on resync depuis serverFilmed
  // après router.refresh. Pas dans le form state car c'est une action atomique
  // (un clic = un save immédiat, comme l'upload image).
  const [optimisticFilmed, setOptimisticFilmed] = useState(serverFilmed);
  useEffect(() => {
    setOptimisticFilmed(serverFilmed);
  }, [serverFilmed]);

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
            className="min-h-12 text-sm [field-sizing:content]"
            value={sceneForm.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
            placeholder={t("fields.actionPlaceholder")}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("fields.camera")}
          </Label>
          <Input
            className="h-8 text-xs"
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
            value={sceneForm.on_screen_text}
            onChange={(e) => onFieldChange("on_screen_text", e.target.value)}
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
            className="min-h-10 text-sm [field-sizing:content]"
            value={sceneForm.editing_notes}
            onChange={(e) => onFieldChange("editing_notes", e.target.value)}
            placeholder="Ex : Filtre vintage, cut net vers Plan 04, whoosh-sound."
          />
        </div>

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
