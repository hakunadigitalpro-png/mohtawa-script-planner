"use client";

import * as React from "react";
import Image from "next/image";
import { Upload, X, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "content-media";

function extractStoragePath(url: string): string | null {
  // public URL : https://{ref}.supabase.co/storage/v1/object/public/content-media/{path}
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

type CompressMode = "photo" | "keep-format";

/**
 * Redimensionne (max 1200 px) + compresse une image côté navigateur AVANT
 * l'upload, pour économiser le stockage.
 *  - "photo" → JPEG 85 % : universel et "prêt à poster" sur les réseaux
 *    (Insta/LinkedIn recompressent de toute façon à ~1080 px → aucune perte
 *    visible). Idéal pour les posts/carrousels/storyboards.
 *  - "keep-format" → conserve le format d'origine (préserve la transparence
 *    des logos PNG).
 * Retombe sur le fichier d'origine si la compression ne fait rien gagner.
 */
async function compressImage(
  file: File,
  mode: CompressMode,
): Promise<{ blob: Blob; ext: string; type: string }> {
  // 1200 px (au lieu de 1600) : le poids d'un JPEG suit la surface, donc
  // -44 % de stockage pour la même image. Sans perte visible ici — les
  // visuels s'affichent à ~300 px dans l'app, les réseaux recompressent à
  // ~1080 px, et 1200 px reste correct à l'impression PDF (~200 dpi en A4).
  const MAX = 1200;
  const fallback = {
    blob: file,
    ext: file.name.split(".").pop()?.toLowerCase() ?? "jpg",
    type: file.type || "image/jpeg",
  };
  try {
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("read"));
      r.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const im = new window.Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("img"));
      im.src = dataUrl;
    });
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, w, h);

    const keepPng = mode === "keep-format" && file.type === "image/png";
    const outType = keepPng ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, outType, outType === "image/jpeg" ? 0.85 : undefined),
    );
    if (!blob || blob.size >= file.size) return fallback;
    return { blob, ext: outType === "image/jpeg" ? "jpg" : "png", type: outType };
  } catch {
    return fallback;
  }
}

export function ImageUpload({
  contentId,
  folder,
  value,
  onChange,
  aspectRatio = "square",
  label = "Ajouter une image",
  bucket = BUCKET,
  pathMode = false,
  compress = "photo",
}: {
  /** Dossier de stockage = un content id (chemin {contentId}/…). */
  contentId?: string;
  /** Dossier de stockage explicite (ex : `presets/{brandId}`). Prioritaire. */
  folder?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  aspectRatio?: "square" | "portrait" | "video";
  label?: string;
  /** Bucket cible. Défaut : `content-media` (public). */
  bucket?: string;
  /**
   * Bucket PRIVÉ : on stocke le *chemin* (pas d'URL publique) via onChange, et
   * on affiche l'image en générant une URL signée temporaire. Défaut : false.
   */
  pathMode?: boolean;
  /**
   * Compression à l'upload : "photo" (défaut) = redimensionne + JPEG 85 %
   * (réseaux sociaux) ; "keep-format" = conserve le format d'origine
   * (préserve la transparence des logos PNG).
   */
  compress?: CompressMode;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // En mode privé, `value` est un chemin de stockage → on résout une URL
  // signée (1h) pour l'affichage. Les valeurs `http…` (legacy public) sont
  // affichées telles quelles. En mode public (défaut), displaySrc === value.
  const isPrivatePath = pathMode && !!value && !value.startsWith("http");
  const [signedSrc, setSignedSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isPrivatePath) {
      setSignedSrc(null);
      return;
    }
    let active = true;
    const supabase = createClient();
    supabase.storage
      .from(bucket)
      .createSignedUrl(value as string, 3600)
      .then(({ data }) => {
        if (active) setSignedSrc(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [isPrivatePath, value, bucket]);
  const displaySrc = isPrivatePath ? signedSrc : value;

  const aspectClass =
    aspectRatio === "portrait"
      ? "aspect-[9/16]"
      : aspectRatio === "video"
        ? "aspect-video"
        : "aspect-square";

  const uploadFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Format non supporté.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Image trop lourde (20 Mo max).");
      return;
    }

    const prefix = folder ?? contentId;
    if (!prefix) {
      setError("Emplacement de stockage manquant.");
      return;
    }

    setUploading(true);
    // Compression à l'upload (1600 px + JPEG 85 % pour les photos) → on économise
    // le stockage tout en gardant une qualité "prête à poster" sur les réseaux.
    const processed = await compressImage(file, compress);
    const supabase = createClient();
    const path = `${prefix}/${crypto.randomUUID()}.${processed.ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, processed.blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: processed.type,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    if (pathMode) {
      // Bucket privé : on stocke le chemin (pas d'URL publique permanente).
      onChange(path);
    } else {
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(publicUrl);
    }
    setUploading(false);
  };

  const onPick = () => inputRef.current?.click();

  const onRemove = async () => {
    if (!value) return;
    // En mode privé, `value` EST déjà le chemin (sauf legacy `http…`).
    const path =
      pathMode && !value.startsWith("http")
        ? value
        : extractStoragePath(value);
    onChange(null);
    if (path) {
      const supabase = createClient();
      await supabase.storage.from(bucket).remove([path]);
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md border-2 border-dashed border-border bg-secondary/40 transition-colors",
          aspectClass,
          dragOver && "border-primary bg-primary/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) uploadFile(file);
        }}
      >
        {value ? (
          <>
            {displaySrc ? (
              <Image
                src={displaySrc}
                alt="Aperçu"
                fill
                sizes="(max-width: 768px) 100vw, 300px"
                className="object-cover"
                // Les URLs signées (bucket privé) pointent sur /object/sign/…,
                // hors des `remotePatterns` de next.config → non optimisables.
                // Les URLs publiques, elles, passent par l'optimiseur (egress).
                unoptimized={isPrivatePath}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                <Upload className="size-5 animate-pulse" />
              </div>
            )}
            <button
              type="button"
              onClick={onRemove}
              className="absolute end-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80"
              aria-label="Retirer l'image"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted hover:text-foreground"
          >
            {uploading ? (
              <Upload className="size-5 animate-pulse" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span className="text-xs font-medium">
              {uploading ? "Envoi..." : label}
            </span>
            <span className="text-[10px] text-muted">
              JPG, PNG, WebP · compressée auto
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
