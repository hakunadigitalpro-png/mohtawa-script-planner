"use client";

import { PreviewUrlField } from "./preview-url-field";
import { parsePreviewUrl, previewProviderLabel } from "@/lib/preview-embed";
import { Card } from "@/components/ui/card";
import { Film } from "lucide-react";

/**
 * Onglet « Vidéo » : le lien externe (Drive/YouTube/Vimeo) et son lecteur
 * intégré juste en dessous. Même composant d'édition que l'onglet Plan
 * d'avant, mais isolé dans sa propre page pour que l'aperçu respire —
 * en Plan on ne voyait rien, le champ était noyé sous les piliers et
 * les publications.
 */
export function VideoTab({
  contentId,
  previewUrl,
}: {
  contentId: string;
  previewUrl: string | null;
}) {
  const embed = parsePreviewUrl(previewUrl);

  return (
    <div className="space-y-4">
      <PreviewUrlField contentId={contentId} initialUrl={previewUrl} />

      {previewUrl && (
        <Card className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <Film className="size-4 text-muted" />
            <h2 className="text-base font-semibold">
              Aperçu
              {embed ? ` · ${previewProviderLabel(embed.provider)}` : ""}
            </h2>
          </div>
          {embed ? (
            <div className="overflow-hidden rounded-2xl bg-black">
              <div className="relative mx-auto aspect-[9/16] w-full max-w-sm">
                <iframe
                  src={embed.src}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                  title="Aperçu vidéo"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Le lien n&apos;est pas reconnu comme Drive, YouTube ou Vimeo —
              côté client un bouton « Ouvrir le lien » le remplacera. Vérifie
              que le partage est bien activé (sur Drive : « Toute personne
              disposant du lien »).
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
