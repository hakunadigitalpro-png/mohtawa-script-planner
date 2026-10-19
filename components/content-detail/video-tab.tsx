"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Film, EyeOff } from "lucide-react";
import { PreviewUrlField } from "./preview-url-field";
import { parsePreviewUrl, previewProviderLabel } from "@/lib/preview-embed";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { updateContent } from "@/app/(app)/contents/actions";

/**
 * Onglet « Vidéo » : le lien externe (Drive/YouTube/Vimeo), son lecteur
 * intégré, et une case « cacher Script + Storyboard » qui apparaît une
 * fois le lien renseigné — quand la vidéo est déjà prête, ces deux
 * onglets ne servent plus et polluent la fiche.
 */
export function VideoTab({
  contentId,
  previewUrl,
  hideProductionTabs,
  canOfferHide,
}: {
  contentId: string;
  previewUrl: string | null;
  hideProductionTabs: boolean;
  /** Faux pour les Stories et pour les formats simples : il n'y a pas de
   *  Script ni de Storyboard à cacher, l'offre n'a pas de sens. */
  canOfferHide: boolean;
}) {
  const router = useRouter();
  const embed = parsePreviewUrl(previewUrl);
  const [pending, startTransition] = React.useTransition();
  const [checked, setChecked] = React.useState(hideProductionTabs);

  React.useEffect(() => setChecked(hideProductionTabs), [hideProductionTabs]);

  const onToggle = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      await updateContent(contentId, { hide_production_tabs: next });
      router.refresh();
    });
  };

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

      {/* La case n'apparaît que quand elle a du sens : il faut une vidéo
          déjà prête ET un format qui a réellement un Script/Storyboard. */}
      {previewUrl && canOfferHide && (
        <Card className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <EyeOff className="size-4 text-muted" />
            <h2 className="text-base font-semibold">
              Afficher ou cacher Script et Storyboard
            </h2>
          </div>
          <p className="text-xs text-muted">
            La vidéo est déjà prête : tu peux cacher les onglets Script et
            Storyboard pour alléger la fiche. Leur contenu reste enregistré
            — il suffira de décocher pour le revoir.
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-card p-3 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => onToggle(Boolean(v))}
              disabled={pending}
            />
            <span>
              <span className="font-medium text-foreground">
                Masquer Script et Storyboard sur cette fiche
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Seuls Plan, Vidéo et Légende resteront visibles.
              </span>
            </span>
          </label>
        </Card>
      )}
    </div>
  );
}
