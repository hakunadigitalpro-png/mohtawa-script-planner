"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { deleteContent } from "@/app/(app)/contents/actions";

export function DeleteContentButton({
  contentId,
  derivedCount = 0,
}: {
  contentId: string;
  /** Les extraits qu'on en a tirés : ils restent, et on le dit. */
  derivedCount?: number;
}) {
  const t = useTranslations("deleteContent");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>{t("confirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {derivedCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {derivedCount === 1
                  ? "L'extrait tiré de ce contenu reste."
                  : `Les ${derivedCount} extraits tirés de ce contenu restent.`}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => startTransition(async () => { await deleteContent(contentId); })}
            >
              {pending ? t("deleting") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
