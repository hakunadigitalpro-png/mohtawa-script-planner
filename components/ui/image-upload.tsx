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
  value,
  onChange,
  aspectRatio = "square",
  label = "Ajouter une image",
}: {
  contentId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  aspectRatio?: "square" | "portrait" | "video";
  label?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

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

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${contentId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    onChange(publicUrl);
    setUploading(false);
  };

  const onPick = () => inputRef.current?.click();

  const onRemove = async () => {
    if (!value) return;
    const path = extractStoragePath(value);
    onChange(null);
    if (path) {
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove([path]);
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
            <Image
              src={value}
              alt="Aperçu"
              fill
              sizes="(max-width: 768px) 100vw, 300px"
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80"
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
