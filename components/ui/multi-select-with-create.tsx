"use client";

import * as React from "react";
import { Plus, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
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

/**
 * Multi-select avec création inline d'éléments (Idée 8).
 *
 * Affiche les valeurs sélectionnées en tant que chips orange. Click sur le
 * trigger "+" ouvre un popover avec :
 *  - Tous les options disponibles avec un état visuel sélectionné/non
 *  - Une option "Créer un nouveau" qui ouvre le dialog existant
 *
 * Important : on rend un input cliquable de la même hauteur que `<Input>`
 * pour rester cohérent visuellement avec les autres champs du Plan.
 */
export function MultiSelectWithCreate({
  values,
  onValuesChange,
  options,
  placeholder = "Ajouter…",
  id,
  onCreate,
  createLabel = "Ajouter",
  createDialogTitle = "Nouvel élément",
  createDialogDescription,
  inputLabel = "Nom",
  inputPlaceholder,
  disabled,
}: {
  values: string[];
  onValuesChange: (next: string[]) => void;
  options: { value: string; label: string }[];
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
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  // Click outside du popover → fermer
  React.useEffect(() => {
    if (!popoverOpen) return;
    function onClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [popoverOpen]);

  const toggle = (val: string) => {
    if (values.includes(val)) {
      onValuesChange(values.filter((v) => v !== val));
    } else {
      onValuesChange([...values, val]);
    }
  };

  const remove = (val: string) => {
    onValuesChange(values.filter((v) => v !== val));
  };

  const onSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreate) return;
    setError(null);
    startTransition(async () => {
      const res = await onCreate(name);
      if ("error" in res && res.error) {
        setError(res.error);
      } else if ("ok" in res && res.ok) {
        // Auto-sélectionne le nouvel élément
        if (!values.includes(res.name)) {
          onValuesChange([...values, res.name]);
        }
        setCreateOpen(false);
        setName("");
        router.refresh();
      }
    });
  };

  return (
    <div ref={wrapperRef} className="relative" id={id}>
      {/* Container avec chips + bouton + */}
      <div
        className={cn(
          "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {values.length === 0 && (
          <span className="text-sm text-muted">{placeholder}</span>
        )}
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              disabled={disabled}
              className="rounded-full p-0.5 hover:bg-accent/20"
              aria-label={`Retirer ${v}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setPopoverOpen((o) => !o)}
          disabled={disabled}
          className="ms-auto inline-flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
          aria-label={createLabel}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Popover avec liste des options */}
      {popoverOpen && (
        <div className="absolute z-20 mt-1 w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl">
          <div className="max-h-60 overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted">
                Aucune option pour cette marque encore.
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {options.map((opt) => {
                  const selected = values.includes(opt.value);
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        onClick={() => toggle(opt.value)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
                          selected
                            ? "bg-accent/10 text-accent"
                            : "hover:bg-background/60",
                        )}
                      >
                        <span>{opt.label}</span>
                        {selected && <Check className="size-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {onCreate && (
            <>
              <div className="h-px bg-border/60" />
              <button
                type="button"
                onClick={() => {
                  setPopoverOpen(false);
                  setCreateOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/5"
              >
                <Plus className="size-3.5" />
                {createLabel}
              </button>
            </>
          )}
        </div>
      )}

      {/* Dialog de création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createDialogTitle}</DialogTitle>
            {createDialogDescription && (
              <DialogDescription>{createDialogDescription}</DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={onSubmitCreate}>
            <DialogBody className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="multi-taxo-name">{inputLabel}</Label>
                <Input
                  id="multi-taxo-name"
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
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
