"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Building2 } from "lucide-react";
import { switchBrand, createBrand } from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/ui/dropdown";
import type { Brand } from "@/lib/types";

export function BrandSwitcher({
  brands,
  active,
}: {
  brands: Brand[];
  active: Brand | null;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const initial = (active?.name ?? "?").slice(0, 1).toUpperCase();

  return (
    <>
      <Dropdown align="start">
        <DropdownTrigger asChild>
          <button
            type="button"
            className="tooltip-trigger flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-sm font-bold text-foreground shadow-sm transition hover:scale-105"
            aria-label={`Marque : ${active?.name ?? "—"}`}
          >
            <span>{initial}</span>
            <span className="tooltip-content">{active?.name ?? "—"}</span>
          </button>
        </DropdownTrigger>
        <DropdownContent align="start" className="min-w-56">
          <DropdownLabel>Mes marques</DropdownLabel>
          {brands.length === 0 && (
            <div className="px-4 py-2 text-sm text-muted">Aucune marque</div>
          )}
          {brands.map((b) => (
            <DropdownItem
              key={b.id}
              onClick={() => {
                startTransition(async () => {
                  await switchBrand(b.id);
                  router.refresh();
                });
              }}
            >
              <Building2 className="size-4 text-muted" />
              <span className="flex-1 truncate">{b.name}</span>
              {active?.id === b.id && <Check className="size-4" />}
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownItem onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nouvelle marque
          </DropdownItem>
        </DropdownContent>
      </Dropdown>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle marque</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) =>
              startTransition(async () => {
                const res = await createBrand(fd);
                if (res?.error) setError(res.error);
                else setCreateOpen(false);
              })
            }
          >
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-name">Nom de la marque</Label>
                <Input id="brand-name" name="name" required autoFocus placeholder="Ex : Nutriclinic" />
              </div>
              {error && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
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
