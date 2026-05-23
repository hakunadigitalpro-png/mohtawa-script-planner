"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Share2,
  Copy,
  Check,
  RefreshCcw,
  Globe,
  Lock,
  MessageSquare,
  Eye,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  enableSharing,
  disableSharing,
  updateShareMode,
} from "@/app/(app)/contents/actions";

export function ShareButton({
  contentId,
  initialToken,
  initialMode = "read",
}: {
  contentId: string;
  initialToken: string | null;
  initialMode?: "read" | "comment";
}) {
  const t = useTranslations("sharing");
  const [open, setOpen] = useState(false);
  const enabled = !!initialToken;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Share2 className="size-3.5" />
        {enabled ? t("buttonOn") : t("buttonOff")}
      </Button>
      {open && (
        <ShareDialog
          contentId={contentId}
          initialToken={initialToken}
          initialMode={initialMode}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareDialog({
  contentId,
  initialToken,
  initialMode,
  onClose,
}: {
  contentId: string;
  initialToken: string | null;
  initialMode: "read" | "comment";
  onClose: () => void;
}) {
  const t = useTranslations("sharing");
  const tCommon = useTranslations("common");
  const [token, setToken] = useState<string | null>(initialToken);
  const [mode, setMode] = useState<"read" | "comment">(initialMode);
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

  const onChangeMode = (newMode: "read" | "comment") => {
    if (newMode === mode) return;
    setError(null);
    setMode(newMode); // optimistic
    startTransition(async () => {
      const res = await updateShareMode(contentId, newMode);
      if (!res.ok) {
        setError(res.error);
        setMode(mode); // revert
      }
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
            {t("dialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
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
                  {enabled ? t("buttonOn") : t("buttonOff")}
                </div>
                <div className="text-xs text-muted">
                  {enabled ? t("warning") : t("indexedHint")}
                </div>
              </div>
            </div>
            <Checkbox checked={enabled} onCheckedChange={onToggle} />
          </div>

          {/* Mode selector — visible uniquement quand le partage est actif */}
          {enabled && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {t("modeLabel")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ModeButton
                  active={mode === "read"}
                  icon={<Eye className="size-4" />}
                  title={t("modeReadTitle")}
                  description={t("modeReadDesc")}
                  onClick={() => onChangeMode("read")}
                  disabled={pending}
                />
                <ModeButton
                  active={mode === "comment"}
                  icon={<MessageSquare className="size-4" />}
                  title={t("modeCommentTitle")}
                  description={t("modeCommentDesc")}
                  onClick={() => onChangeMode("comment")}
                  disabled={pending}
                />
              </div>
            </div>
          )}

          {/* Link */}
          {enabled && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {t("linkLabel")}
              </div>
              <div className="flex items-center gap-2">
                <Input value={link} readOnly className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onCopy}
                  aria-label={t("copy")}
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
                  {t("regenerate")}
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
            {tCommon("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-start transition",
        active
          ? "border-accent bg-accent/5 shadow-sm"
          : "border-border/60 bg-card hover:border-foreground/30",
        disabled && "opacity-60",
      )}
    >
      <div
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-lg",
          active
            ? "bg-accent text-accent-foreground"
            : "bg-secondary text-muted",
        )}
      >
        {icon}
      </div>
      <div className="text-xs font-bold">{title}</div>
      <div className="text-[10px] leading-snug text-muted">{description}</div>
    </button>
  );
}
