"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { switchBrand, createBrand } from "@/app/(app)/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Brand } from "@/lib/types";

export function BrandSwitcher({
  brands,
  active,
}: {
  brands: Brand[];
  active: Brand | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="size-4 shrink-0 text-muted" />
          <span className="truncate">{active?.name ?? "Aucune marque"}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-card shadow-lg">
            <ul className="max-h-60 overflow-auto py-1">
              {brands.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted">Aucune marque</li>
              )}
              {brands.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      startTransition(async () => {
                        await switchBrand(b.id);
                        setOpen(false);
                        router.refresh();
                      });
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="truncate">{b.name}</span>
                    {active?.id === b.id && <Check className="size-4" />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreateOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <Plus className="size-4" />
                Nouvelle marque
              </button>
            </div>
          </div>
        </>
      )}

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
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
