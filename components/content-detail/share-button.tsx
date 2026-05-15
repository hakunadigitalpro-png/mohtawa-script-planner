"use client";

import { useState, useTransition } from "react";
import { Share2, Copy, Check, RefreshCcw, Globe, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  enableSharing,
  disableSharing,
} from "@/app/(app)/contents/actions";

export function ShareButton({
  contentId,
  initialToken,
}: {
  contentId: string;
  initialToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Share2 className="size-3.5" />
        Partager
      </Button>
      {open && (
        <ShareDialog
          contentId={contentId}
          initialToken={initialToken}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareDialog({
  contentId,
  initialToken,
  onClose,
}: {
  contentId: string;
  initialToken: string | null;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const enabled = !!token;
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const link = token ? `${origin}/share/${token}` : "";

  const onToggle = (checked: boolean) => {
    setError(null);
    startTransition(async () => {
      if (checked) {
        const res = await enableSharing(contentId);
        if (!res.ok) setError(res.error);
        else setToken(res.token);
      } else {
        const res = await disableSharing(contentId);
        if (!res.ok) setError(res.error);
        else setToken(null);
      }
    });
  };

  const onRotate = () => {
    setError(null);
    startTransition(async () => {
      const res = await enableSharing(contentId);
      if (!res.ok) setError(res.error);
      else setToken(res.token);
    });
  };

  const onCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no-op */
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4" />
            Partager cette vidéo
          </DialogTitle>
          <DialogDescription>
            Toute personne avec ce lien pourra consulter la fiche (lecture
            seule). Désactive le lien quand tu veux pour révoquer l&apos;accès.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-secondary/40 p-4">
            <div className="flex items-start gap-3">
              <div
                className={
                  "flex size-9 items-center justify-center rounded-full " +
                  (enabled
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-secondary text-muted")
                }
              >
                {enabled ? <Globe className="size-4" /> : <Lock className="size-4" />}
              </div>
              <div>
                <div className="text-sm font-semibold">
                  {enabled ? "Lien public actif" : "Vidéo privée"}
                </div>
                <div className="text-xs text-muted">
                  {enabled
                    ? "N'importe qui avec le lien peut voir."
                    : "Active le lien pour partager avec quelqu'un."}
                </div>
              </div>
            </div>
            <Checkbox checked={enabled} onCheckedChange={onToggle} />
          </div>

          {/* Link */}
          {enabled && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Lien de partage
              </div>
              <div className="flex items-center gap-2">
                <Input value={link} readOnly className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onCopy}
                  aria-label="Copier le lien"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onRotate}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
                >
                  <RefreshCcw className="size-3.5" />
                  Générer un nouveau lien (révoque l&apos;ancien)
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
