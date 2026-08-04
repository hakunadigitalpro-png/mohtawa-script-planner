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

export function ImageUpload({
  contentId,
  folder,
  value,
  onChange,
  aspectRatio = "square",
  label = "Ajouter une image",
  bucket = BUCKET,
  pathMode = false,
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
    if (file.size > 5 * 1024 * 1024) {
      setError("Image trop lourde (5 Mo max).");
      return;
    }

    const prefix = folder ?? contentId;
    if (!prefix) {
      setError("Emplacement de stockage manquant.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: "3600", upsert: false });

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
                unoptimized
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
              JPG, PNG, WebP · 5 Mo max
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
