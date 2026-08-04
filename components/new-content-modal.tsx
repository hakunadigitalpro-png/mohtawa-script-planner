"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CONTENT_TYPES, platformsForType } from "@/lib/constants";
import { createContent } from "@/app/(app)/contents/actions";

export function NewContentButton({
  defaultType,
  defaultDate,
  variant = "default",
  label,
}: {
  defaultType?: string;
  defaultDate?: string;
  variant?: "default" | "outline" | "secondary";
  label?: string;
}) {
  const t = useTranslations("newContent");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {label ?? t("buttonLabel")}
      </Button>
      <NewContentModal
        open={open}
        onOpenChange={setOpen}
        defaultType={defaultType}
        defaultDate={defaultDate}
      />
    </>
  );
}

export function NewContentModal({
  open,
  onOpenChange,
  defaultType = "reel",
  defaultDate,
  defaultTitle,
  pillar,
  brandId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType?: string;
  defaultDate?: string;
  /** Pré-remplit le titre (ex : depuis un exemple d'un thème). */
  defaultTitle?: string;
  /** Thème de contenu à rattacher à la vidéo créée. */
  pillar?: string;
  /** Marque explicite (ex : création depuis la page d'une marque). */
  brandId?: string;
}) {
  const t = useTranslations("newContent");
  const tCommon = useTranslations("common");
  const tType = useTranslations("contentTypes");
  const tPlatform = useTranslations("platforms");
  const [type, setType] = useState(defaultType);
  const [platform, setPlatform] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const availablePlatforms = platformsForType(type);

  const safeT = (
    fn: (k: string) => string,
    key: string,
    fallback: string,
  ) => {
    try {
      return fn(key);
    } catch {
      return fallback;
    }
  };

  const formatLabel = safeT(
    tType,
    type,
    CONTENT_TYPES.find((c) => c.value === type)?.label ?? type,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { format: formatLabel })}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <form
          action={(fd) =>
            startTransition(async () => {
              const res = await createContent({
                type,
                title: String(fd.get("title") ?? "").trim(),
                date: (fd.get("date") as string) || null,
                platform: platform || null,
                pillar: pillar || undefined,
                brandId: brandId || undefined,
              });
              if (res?.error) setError(res.error);
            })
          }
        >
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">{t("format")}</Label>
                <Select
                  id="type"
                  value={type}
                  onValueChange={(v) => {
                    setType(v);
                    setPlatform(""); // reset platform when type changes
                  }}
                  options={CONTENT_TYPES.map((ct) => ({
                    value: ct.value,
                    label: safeT(tType, ct.value, ct.label),
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform">{t("platform")}</Label>
                <Select
                  id="platform"
                  value={platform}
                  onValueChange={setPlatform}
                  placeholder={t("noPlatform")}
                  options={availablePlatforms.map((p) => ({
                    value: p.value,
                    label: safeT(tPlatform, p.value, p.label),
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t("videoTitle")}</Label>
              <Input
                id="title"
                name="title"
                defaultValue={defaultTitle}
                placeholder={t("titlePlaceholder")}
                dir="auto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">{t("date")}</Label>
              <Input id="date" name="date" type="date" defaultValue={defaultDate} />
            </div>

            {error && (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("submitLoading") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
