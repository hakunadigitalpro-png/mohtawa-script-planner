"use client";

import { useState, useTransition } from "react";
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
  label = "Nouvelle vidéo",
}: {
  defaultType?: string;
  defaultDate?: string;
  variant?: "default" | "outline" | "secondary";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {label}
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType?: string;
  defaultDate?: string;
}) {
  const [type, setType] = useState(defaultType);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const availablePlatforms = platformsForType(type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle vidéo</DialogTitle>
          <DialogDescription>Chaque vidéo commence par une idée claire.</DialogDescription>
        </DialogHeader>
        <form
          action={(fd) =>
            startTransition(async () => {
              const res = await createContent({
                type: String(fd.get("type") ?? "reel"),
                title: String(fd.get("title") ?? "").trim(),
                date: (fd.get("date") as string) || null,
                platform: (fd.get("platform") as string) || null,
              });
              if (res?.error) setError(res.error);
            })
          }
        >
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Format</Label>
                <Select
                  id="type"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform">Plateforme</Label>
                <Select id="platform" name="platform" defaultValue="">
                  <option value="">—</option>
                  {availablePlatforms.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input id="title" name="title" placeholder="Ex : 3 erreurs que font les créateurs débutants" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date de publication prévue</Label>
              <Input id="date" name="date" type="date" defaultValue={defaultDate} />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Création..." : "Créer et continuer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
