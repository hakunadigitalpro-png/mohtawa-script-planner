"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setBrandAiEnabled } from "../brand-ai-actions";

/**
 * « Sur cette marque, on écrit à la main. »
 *
 * Le libellé ne parle PAS du client, et c'est voulu : un client invité
 * (rôle viewer) ne voit aucun bouton IA — il est renvoyé de la fiche vers
 * sa page de validation, de la page marque vers le calendrier, et Krea
 * n'est même pas rendue pour lui. L'interrupteur agit donc sur l'équipe,
 * pas sur le client. L'annoncer autrement serait mentir sur ce qu'il fait.
 */
export function BrandAiSwitch({
  brandId,
  initialEnabled,
}: {
  brandId: string;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next); // optimiste : le basculement doit être instantané
    setError(null);
    startTransition(async () => {
      const res = await setBrandAiEnabled(brandId, next);
      if (!res.ok) {
        setEnabled(!next); // on revient en arrière plutôt que de mentir
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {enabled ? (
              <Sparkles className="size-4 text-accent" />
            ) : (
              <PenLine className="size-4 text-muted" />
            )}
            Écriture assistée
          </h2>
          <p className="max-w-prose text-sm text-muted">
            {enabled
              ? "Les boutons de génération sont disponibles sur les contenus de cette marque : scripts, légendes, découpage du storyboard, et Krea."
              : "Sur cette marque, vous écrivez à la main. Les boutons de génération sont masqués sur les contenus, et Krea n'écrit plus de texte."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Écriture assistée par l'IA"
          onClick={toggle}
          disabled={pending}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
            enabled ? "bg-accent" : "bg-border",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {/* Ce que l'interrupteur NE coupe PAS — sans cette phrase, on croirait
          que l'assistant de thèmes et le studio de marque ont disparu. */}
      <p className="rounded-xl bg-secondary/50 px-3.5 py-2.5 text-xs text-foreground/70">
        L&apos;assistant de thèmes et le studio de marque restent disponibles
        dans les deux cas : ce sont eux qui mettent la marque en place, et le
        reste de l&apos;application s&apos;appuie dessus.
      </p>

      {error && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </Card>
  );
}
