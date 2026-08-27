"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { createBrand } from "@/app/(app)/actions";

export function CreateBrandButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nouvelle marque
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle marque</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) =>
              startTransition(async () => {
                const res = await createBrand(fd);
                if (res?.error) setError(res.error);
                else setOpen(false);
              })
            }
          >
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de la marque</Label>
                <Input id="name" name="name" required autoFocus placeholder="Ex : Nutriclinic" />
              </div>
              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
