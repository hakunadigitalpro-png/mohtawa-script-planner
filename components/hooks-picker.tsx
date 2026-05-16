"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogDescription,
} from "@/components/ui/dialog";
import { HooksLibrary } from "./hooks-library";

export function HooksPickerButton({
  onPick,
}: {
  onPick: (text: string) => void;
}) {
  const t = useTranslations("hooks");
  const tPlan = useTranslations("plan");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <BookOpen className="size-3.5" />
        {tPlan("pickHook")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("pickerTitle")}</DialogTitle>
            <DialogDescription>{t("pickerSubtitle")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[70vh] overflow-y-auto">
            <HooksLibrary
              onPick={(text) => {
                onPick(text);
                setOpen(false);
              }}
              pickLabel={t("use")}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
