"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { CaptionTab } from "./caption-tab";
import {
  addContentVisual,
  removeContentVisual,
  reorderContentVisuals,
} from "@/app/(app)/contents/actions";
import type { ContentMedia } from "@/lib/types";

/**
 * Onglet "Contenu" des formats non-vidéo (post/carrousel/infographie) :
 * les visuels ordonnés + la légende. Un post/infographie = 1 visuel ; un
 * carrousel = plusieurs, réordonnables au glisser-déposer.
 */
export function ContentTab({
  contentId,
  caption,
  visuals,
  isCarousel,
}: {
  contentId: string;
  caption: string | null;
  visuals: ContentMedia[];
  isCarousel: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(visuals);
  const [pending, startTransition] = React.useTransition();
  const dragFrom = React.useRef<number | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => setItems(visuals), [visuals]);

  React.useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  const onAdd = (url: string | null) => {
    if (!url) return;
    startTransition(async () => {
      await addContentVisual(contentId, url);
      router.refresh();
    });
  };

  const onRemove = (mediaId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== mediaId));
    startTransition(async () => {
      await removeContentVisual(mediaId, contentId);
      router.refresh();
    });
  };

  const onDrop = (to: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    startTransition(async () => {
      await reorderContentVisuals(
        contentId,
        next.map((it) => it.id),
      );
      router.refresh();
    });
  };

  // Post / Infographie : un seul visuel → on masque l'ajout dès qu'il y en a un.
  const canAdd = isCarousel || items.length === 0;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-base font-semibold">
            {isCarousel ? "Visuels du carrousel" : "Visuel"}
          </h2>
          <p className="text-xs text-muted">
            {isCarousel
              ? "Ajoute tes slides dans l'ordre — glisse pour réordonner."
              : "L'image de ton post."}
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          {items.map((it, idx) => (
            <div
              key={it.id}
              draggable={isCarousel}
              onDragStart={() => {
                dragFrom.current = idx;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(idx)}
              className={isCarousel ? "w-24 cursor-grab" : "w-24"}
            >
              <div
                className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-lg border border-border bg-secondary/40"
                onClick={() => it.image_url && setPreview(it.image_url)}
                title="Cliquer pour agrandir"
              >
                {it.image_url && (
                  <Image
                    src={it.image_url}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
                {isCarousel && (
                  <span className="absolute start-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(it.id);
                  }}
                  className="absolute end-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  aria-label="Retirer le visuel"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          ))}

          {canAdd && (
            <div className="w-24">
              <ImageUpload
                key={`add-${items.length}`}
                contentId={contentId}
                value={null}
                aspectRatio="portrait"
                onChange={onAdd}
                label={isCarousel ? "+ Slide" : "+ Visuel"}
              />
            </div>
          )}
        </div>

        {pending && <p className="text-xs text-muted">Enregistrement…</p>}
      </Card>

      <CaptionTab contentId={contentId} caption={caption} />

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute end-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Fermer l'aperçu"
          >
            <X className="size-5" />
          </button>
          <div
            className="relative h-[88vh] w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={preview}
              alt="Aperçu du visuel"
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
