"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { CommentButton } from "@/components/comments";
import { cn } from "@/lib/utils";
import {
  addScene,
  deleteScene,
  updateScene,
  reorderScenes,
} from "@/app/(app)/contents/actions";
import type { StoryboardScene } from "@/lib/types";

const DRAG_MIME = "application/x-mohtawa-scene-id";

export function StoryboardTab({
  contentId,
  scenes: initialScenes,
}: {
  contentId: string;
  scenes: StoryboardScene[];
}) {
  const t = useTranslations("storyboard");
  const [scenes, setScenes] = useState(initialScenes);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Garde l'état local en sync si le parent re-fetch
  useEffect(() => setScenes(initialScenes), [initialScenes]);

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

    // Optimistic reorder
    const next = [...scenes];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(idx, 0, moved);
    setScenes(next);

    startTransition(async () => {
      await reorderScenes(
        contentId,
        next.map((s) => s.id),
      );
    });
  };

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted">{t("subtitle")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => startTransition(async () => { await addScene(contentId); })}
          disabled={pending}
        >
          <Plus className="size-4" />
          {t("addScene")}
        </Button>
      </div>

      {scenes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("emptySubtitle")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene, idx) => (
            <div
              key={scene.id}
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
                scene={scene}
                index={idx}
                contentId={contentId}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SceneCard({
  scene,
  index,
  contentId,
}: {
  scene: StoryboardScene;
  index: number;
  contentId: string;
}) {
  const t = useTranslations("storyboard");
  const [state, setState] = useState({
    description: scene.description ?? "",
    camera_angle: scene.camera_angle ?? "",
    on_screen_text: scene.on_screen_text ?? "",
    image_url: scene.image_url ?? null,
  });
  const [pending, startTransition] = useTransition();

  // Sync if scene props change (after reorder server refresh)
  useEffect(() => {
    setState({
      description: scene.description ?? "",
      camera_angle: scene.camera_angle ?? "",
      on_screen_text: scene.on_screen_text ?? "",
      image_url: scene.image_url ?? null,
    });
  }, [scene.id, scene.description, scene.camera_angle, scene.on_screen_text, scene.image_url]);

  const save = (next: typeof state) => {
    startTransition(async () => {
      await updateScene(scene.id, next, contentId);
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
          <CommentButton targetType="scene" targetId={scene.id} size="sm" />
          <button
            type="button"
            onClick={() =>
              startTransition(async () => { await deleteScene(scene.id, contentId); })
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
          value={state.image_url}
          aspectRatio="video"
          onChange={(url) => {
            const next = { ...state, image_url: url };
            setState(next);
            save(next);
          }}
          label={t("fields.action")}
        />

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("fields.action")}
          </Label>
          <Textarea
            className="min-h-16 text-sm"
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            onBlur={() => save(state)}
            placeholder={t("fields.actionPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("fields.camera")}
          </Label>
          <Input
            className="h-9 text-sm"
            value={state.camera_angle}
            onChange={(e) => setState((s) => ({ ...s, camera_angle: e.target.value }))}
            onBlur={() => save(state)}
            placeholder={t("fields.cameraPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("fields.onScreenText")}
          </Label>
          <Input
            className="h-9 text-sm"
            value={state.on_screen_text}
            onChange={(e) => setState((s) => ({ ...s, on_screen_text: e.target.value }))}
            onBlur={() => save(state)}
            placeholder={t("fields.onScreenTextPlaceholder")}
          />
        </div>
      </div>
    </div>
  );
}
