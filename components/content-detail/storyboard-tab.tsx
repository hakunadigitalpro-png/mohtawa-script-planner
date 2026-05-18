"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { CommentButton } from "@/components/comments";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  addScene,
  deleteScene,
  updateScene,
  reorderScenes,
} from "@/app/(app)/contents/actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import type { StoryboardScene } from "@/lib/types";

const DRAG_MIME = "application/x-mohtawa-scene-id";

type SceneFormState = {
  id: string;
  description: string;
  camera_angle: string;
  on_screen_text: string;
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
        `${s.id}:${s.description ?? ""}:${s.camera_angle ?? ""}:${s.on_screen_text ?? ""}`,
    )
    .join("|");

  const initial = useMemo(
    () => ({
      scenes: initialScenes.map<SceneFormState>((s) => ({
        id: s.id,
        description: s.description ?? "",
        camera_angle: s.camera_angle ?? "",
        on_screen_text: s.on_screen_text ?? "",
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
    key: "description" | "camera_angle" | "on_screen_text",
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted">{t("subtitle")}</p>
          </div>
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

        {state.scenes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("emptySubtitle")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  index,
  contentId,
  onFieldChange,
}: {
  sceneForm: SceneFormState;
  serverImageUrl: string | null;
  index: number;
  contentId: string;
  onFieldChange: (
    key: "description" | "camera_angle" | "on_screen_text",
    value: string,
  ) => void;
}) {
  const t = useTranslations("storyboard");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onImageChange = (url: string | null) => {
    startTransition(async () => {
      await updateScene(sceneForm.id, { image_url: url }, contentId);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <GripVertical className="size-3.5 cursor-grab text-muted active:cursor-grabbing" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            {t("planNumber", { n: String(index + 1).padStart(2, "0") })}
          </span>
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

      <div className="space-y-3 p-3">
        <ImageUpload
          contentId={contentId}
          value={serverImageUrl}
          aspectRatio="video"
          onChange={onImageChange}
          label={t("fields.action")}
        />

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("fields.action")}
          </Label>
          <Textarea
            className="min-h-16 text-sm"
            value={sceneForm.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
            placeholder={t("fields.actionPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("fields.camera")}
          </Label>
          <Input
            className="h-9 text-sm"
            value={sceneForm.camera_angle}
            onChange={(e) => onFieldChange("camera_angle", e.target.value)}
            placeholder={t("fields.cameraPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("fields.onScreenText")}
          </Label>
          <Input
            className="h-9 text-sm"
            value={sceneForm.on_screen_text}
            onChange={(e) => onFieldChange("on_screen_text", e.target.value)}
            placeholder={t("fields.onScreenTextPlaceholder")}
          />
        </div>
      </div>
    </div>
  );
}
