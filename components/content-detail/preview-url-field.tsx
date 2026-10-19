"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Film, ExternalLink, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { updateContent } from "@/app/(app)/contents/actions";
import { parsePreviewUrl, previewProviderLabel } from "@/lib/preview-embed";

/**
 * Un champ atomique pour le lien externe de la vidéo prête (Drive, YouTube,
 * Vimeo…). Enregistré au blur, comme le titre : pas de bouton Enregistrer,
 * pas de risque qu'il interfère avec le formulaire principal du Plan.
 *
 * Dès qu'on reconnaît la source, on la nomme à côté du champ (« Google Drive »,
 * « YouTube »…) pour que l'utilisatrice sache tout de suite que ce sera
 * jouable sur /review. Un lien non reconnu passe quand même : il devient un
 * simple bouton « Ouvrir le lien » côté client.
 */
export function PreviewUrlField({
  contentId,
  initialUrl,
}: {
  contentId: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialUrl ?? "");
  const [saved, setSaved] = React.useState(initialUrl ?? "");
  const [pending, startTransition] = React.useTransition();
  const [justSaved, setJustSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parsed = parsePreviewUrl(value);
  const providerLabel = parsed ? previewProviderLabel(parsed.provider) : null;

  const commit = () => {
    const next = value.trim();
    if (next === saved.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContent(contentId, {
        preview_url: next || null,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setSaved(next);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
      router.refresh();
    });
  };

  return (
    <Card className="space-y-3 p-6">
      <div className="flex items-center gap-2">
        <Film className="size-4 text-muted" />
        <h2 className="text-base font-semibold">Vidéo prête (lien externe)</h2>
      </div>
      <p className="text-xs text-muted">
        Colle ici le lien Google Drive, YouTube ou Vimeo de la vidéo
        déjà tournée. Le client la verra directement dans son écran de
        validation — sans que tu la ré-uploades.
      </p>
      <div className="space-y-2">
        <Label htmlFor="preview-url" className="sr-only">
          Lien de la vidéo
        </Label>
        <Input
          id="preview-url"
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          disabled={pending}
          placeholder="https://drive.google.com/file/d/…/view"
          dir="ltr"
        />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {providerLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 font-medium text-foreground/70">
              <Check className="size-3" /> Lecteur {providerLabel} reconnu
            </span>
          )}
          {value && !providerLabel && (
            <span className="text-muted">
              Lien non reconnu : il s&apos;affichera comme bouton « Ouvrir le lien ».
            </span>
          )}
          {saved && (
            <a
              href={saved}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-foreground/70 hover:text-foreground"
            >
              <ExternalLink className="size-3" /> Ouvrir
            </a>
          )}
          {justSaved && !error && (
            <span className="text-muted">Enregistré ✓</span>
          )}
          {error && <span className="text-destructive">{error}</span>}
        </div>
      </div>
    </Card>
  );
}
