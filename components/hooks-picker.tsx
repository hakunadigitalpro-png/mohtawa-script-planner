"use client";

import { useState } from "react";
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
        Choisir une accroche
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bibliothèque d&apos;accroches</DialogTitle>
            <DialogDescription>
              Clique sur « Utiliser » pour remplacer l&apos;accroche de ta vidéo.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[70vh] overflow-y-auto">
            <HooksLibrary
              onPick={(text) => {
                onPick(text);
                setOpen(false);
              }}
              pickLabel="Utiliser"
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
