"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Link2, RefreshCcw, Share2 } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  disableAdCampaignSharing,
  enableAdCampaignSharing,
} from "@/app/(app)/ads/actions";

/**
 * Partager la campagne par un lien, avec n'importe qui, sans compte. La page
 * montre la proposition et les annonces en lecture seule ; jamais les remarques
 * ni l'historique. Renouveler le lien coupe l'ancien.
 */
export function AdShareButton({
  campaignId,
  initialToken,
}: {
  campaignId: string;
  initialToken: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [token, setToken] = React.useState(initialToken);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const link =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/share/ad/${token}`
      : "";

  const create = () => {
    setError(null);
    startTransition(async () => {
      const res = await enableAdCampaignSharing(campaignId);
      if (!res.ok) setError(res.error);
      else setToken(res.token);
    });
  };

  const stop = () => {
    setError(null);
    startTransition(async () => {
      const res = await disableAdCampaignSharing(campaignId);
      if (!res.ok) setError(res.error);
      else setToken(null);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papiers refusé : le lien reste sélectionnable dans le champ */
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        {token ? "Partagée" : "Partager"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4" />
              Partager la campagne
            </DialogTitle>
            <DialogDescription>
              Toute personne qui a le lien voit la campagne en lecture seule, sans
              compte : période, objectif, texte, budget, ciblage, annonces et
              résultats. Jamais les remarques ni l&apos;historique.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {token ? (
              <>
                <div className="flex gap-2">
                  <Input value={link} readOnly onFocus={(e) => e.target.select()} />
                  <Button type="button" onClick={copy} disabled={!link}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copié" : "Copier"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-secondary"
                  >
                    <ExternalLink className="size-3.5" />
                    Voir la page
                  </a>
                  <button
                    type="button"
                    onClick={create}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-secondary"
                  >
                    <RefreshCcw className="size-3.5" />
                    Nouveau lien
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  « Nouveau lien » coupe l&apos;ancien : à faire si le lien est parti
                  chez quelqu&apos;un qui ne devait pas l&apos;avoir.
                </p>
              </>
            ) : (
              <Button type="button" onClick={create} disabled={pending}>
                <Link2 className="size-4" />
                {pending ? "Création…" : "Créer le lien"}
              </Button>
            )}
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </DialogBody>
          {token && (
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={stop} disabled={pending}>
                Désactiver le lien
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
