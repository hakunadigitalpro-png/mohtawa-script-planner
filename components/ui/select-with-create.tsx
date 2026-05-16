"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, type SelectOption } from "@/components/ui/select";
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
  DialogDescription,
} from "@/components/ui/dialog";

export type CreateResult =
  | { ok: true; id?: string; name: string }
  | { error: string };

export function SelectWithCreate({
  value,
  onValueChange,
  options,
  placeholder = "—",
  id,
  onCreate,
  createLabel = "Ajouter",
  createDialogTitle = "Nouvel élément",
  createDialogDescription,
  inputLabel = "Nom",
  inputPlaceholder,
  disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  onCreate?: (name: string) => Promise<CreateResult>;
  createLabel?: string;
  createDialogTitle?: string;
  createDialogDescription?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreate) return;
    setError(null);
    startTransition(async () => {
      const res = await onCreate(name);
      if ("error" in res && res.error) {
        setError(res.error);
      } else if ("ok" in res && res.ok) {
        onValueChange(res.name);
        setOpen(false);
        setName("");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Select
          id={id}
          value={value}
          onValueChange={onValueChange}
          options={[{ value: "", label: placeholder }, ...options]}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>

      {onCreate && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
          aria-label={createLabel}
          title={createLabel}
        >
          <Plus className="size-4" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createDialogTitle}</DialogTitle>
            {createDialogDescription && (
              <DialogDescription>{createDialogDescription}</DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={onSubmit}>
            <DialogBody className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="taxo-name">{inputLabel}</Label>
                <Input
                  id="taxo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                  placeholder={inputPlaceholder}
                />
              </div>
              {error && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Ajout..." : createLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
