"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTaxonomy,
  renameTaxonomy,
  deleteTaxonomy,
} from "@/app/(app)/brands/taxonomy-actions";

type Kind = "pillar" | "objective";
type Item = { id: string; name: string };

export function TaxonomyManager({
  kind,
  brandId,
  items,
  emptyLabel,
  inputPlaceholder,
  addLabel,
}: {
  kind: Kind;
  brandId: string;
  items: Item[];
  emptyLabel: string;
  inputPlaceholder: string;
  addLabel: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createTaxonomy(kind, brandId, newName);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setNewName("");
        setAdding(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <p className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm text-muted">
          {emptyLabel}
        </p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <TaxonomyChip
              key={item.id}
              kind={kind}
              brandId={brandId}
              item={item}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={onAdd} className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={inputPlaceholder}
            autoFocus
            required
            className="max-w-xs"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "..." : "Ajouter"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAdding(false);
              setNewName("");
              setError(null);
            }}
          >
            Annuler
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" />
          {addLabel}
        </Button>
      )}

      {error && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function TaxonomyChip({
  kind,
  brandId,
  item,
}: {
  kind: Kind;
  brandId: string;
  item: Item;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await renameTaxonomy(kind, item.id, name, brandId);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  };

  const onDelete = () => {
    if (!confirm(`Supprimer « ${item.name} » ?\n\nLes vidéos qui l'utilisaient garderont la valeur en texte libre.`)) return;
    startTransition(async () => {
      const res = await deleteTaxonomy(kind, item.id, brandId);
      if ("error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  };

  if (editing) {
    return (
      <li className="flex items-center gap-1.5 rounded-full border border-border bg-card pl-3 pr-1 py-0.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="bg-transparent text-sm font-semibold outline-none w-32"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          <Check className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setName(item.name);
            setError(null);
          }}
          className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-secondary"
        >
          <X className="size-3.5" />
        </button>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-0.5 text-sm font-semibold">
      <span>{item.name}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex size-7 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"
        aria-label="Renommer"
      >
        <Pencil className="size-3" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="flex size-7 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Supprimer"
      >
        <Trash2 className="size-3" />
      </button>
      {error && (
        <span className="ml-2 text-xs text-destructive">{error}</span>
      )}
    </li>
  );
}
