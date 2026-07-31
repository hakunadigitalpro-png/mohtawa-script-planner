"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X, Check, Video, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NewContentModal } from "@/components/new-content-modal";
import { cn } from "@/lib/utils";
import {
  createTaxonomy,
  updatePillar,
  deleteTaxonomy,
} from "@/app/(app)/brands/taxonomy-actions";
import type { BrandPillar } from "@/lib/types";

/**
 * Gestion des piliers de contenu ENRICHIS (migration 0028).
 * Chaque pilier = une carte pliable qui porte : objectif, rubriques,
 * exemples, note et part visée (%). Pensé comme une référence anti-page-
 * blanche : on y consulte quoi filmer pour ce pilier.
 *
 * Ajout d'un pilier = nom seul (rapide), puis on ouvre l'édition pour
 * remplir les détails (ou coller sa stratégie).
 */
export function PillarManager({
  brandId,
  pillars,
}: {
  brandId: string;
  pillars: BrandPillar[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createTaxonomy("pillar", brandId, newName);
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
      {pillars.length === 0 && !adding && (
        <p className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm text-muted">
          Aucun thème pour l&apos;instant. Génère-les avec l&apos;IA ci-dessus,
          ou ajoute-les à la main (ex : « Prévention & Conseils »…).
        </p>
      )}

      {pillars.length > 0 && (
        <ul className="space-y-4">
          {pillars.map((p) => (
            <li key={p.id}>
              <PillarCard brandId={brandId} pillar={p} />
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={onAdd} className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom du thème (ex : 🦶 Prévention & Conseils)"
            autoFocus
            required
            dir="auto"
            className="max-w-sm"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "..." : "Créer"}
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
          Ajouter un thème
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

/* ============================== Carte pilier ============================== */

function PillarCard({
  brandId,
  pillar,
}: {
  brandId: string;
  pillar: BrandPillar;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [delError, setDelError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const onDelete = () => {
    setDelError(null);
    if (!confirm(`Supprimer le thème « ${pillar.name} » ?`)) return;
    startTransition(async () => {
      const res = await deleteTaxonomy("pillar", pillar.id, brandId);
      if ("error" in res && res.error) setDelError(res.error);
      else router.refresh();
    });
  };

  if (editing) {
    return (
      <PillarEditor
        brandId={brandId}
        pillar={pillar}
        onDone={() => setEditing(false)}
      />
    );
  }

  const hasDetails =
    pillar.objective ||
    pillar.note ||
    pillar.rubriques.length > 0 ||
    pillar.examples.length > 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        {/* En-tête cliquable = accordéon : replie/déplie les détails. */}
        <button
          type="button"
          onClick={() => hasDetails && setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-2 text-start",
            hasDetails ? "cursor-pointer" : "cursor-default",
          )}
        >
          {hasDetails && (
            <ChevronDown
              className={cn(
                "mt-1 size-4 shrink-0 text-muted transition-transform",
                open ? "" : "-rotate-90",
              )}
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h4 className="text-lg font-bold leading-tight" dir="auto">
                {pillar.name}
              </h4>
              {pillar.share_pct != null && (
                <span className="rounded-full bg-accent/15 px-2.5 py-1 text-sm font-bold text-accent">
                  {pillar.share_pct}%
                </span>
              )}
            </div>
            {/* Replié : aperçu (objectif tronqué, sinon compteurs). */}
            {hasDetails && !open && (
              <p dir="auto" className="mt-1 truncate text-sm text-muted">
                {pillar.objective ||
                  `${pillar.rubriques.length} rubriques · ${pillar.examples.length} exemples`}
              </p>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-secondary hover:text-foreground"
            aria-label="Éditer le thème"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label="Supprimer le thème"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {delError && (
        <p className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {delError}
        </p>
      )}

      {!hasDetails ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 text-sm font-semibold text-accent hover:underline"
        >
          + Ajouter les détails (objectif, rubriques, exemples…)
        </button>
      ) : (
        open && (
          <div className="mt-4 space-y-4" dir="auto">
            {pillar.objective && (
              <Detail label="Objectif">
                <p className="text-[15px] leading-relaxed text-foreground/90">
                  {pillar.objective}
                </p>
              </Detail>
            )}

            {pillar.rubriques.length > 0 && (
              <Detail label={`Rubriques · ${pillar.rubriques.length}`}>
                <ChipRow items={pillar.rubriques} />
              </Detail>
            )}

            {pillar.examples.length > 0 && (
              <Detail label={`Exemples · ${pillar.examples.length}`}>
                <ExampleLauncher
                  brandId={brandId}
                  themeName={pillar.name}
                  items={pillar.examples}
                />
              </Detail>
            )}

            {pillar.note && (
              <p className="rounded-xl border-s-2 border-accent/50 bg-secondary/40 px-4 py-2.5 text-sm leading-relaxed text-foreground/80">
                👉 {pillar.note}
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}

/** En-tête de section lisible (casse normale, 14px) — remplace les micro-
 *  labels 11px MAJUSCULES qui fatiguaient l'œil. */
function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h5 className="text-sm font-semibold text-foreground/70">{label}</h5>
      {children}
    </div>
  );
}

/** Chips lisibles : 14px, fond plein + bordure pour le contraste. */
function ChipRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it, i) => (
        <span
          key={i}
          dir="auto"
          className="rounded-lg border border-border/60 bg-secondary/70 px-3 py-1 text-sm text-foreground/90"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

/**
 * Exemples = idées de vidéos concrètes → chaque ligne a un bouton « Vidéo »
 * qui ouvre la fenêtre Nouvelle vidéo PRÉ-REMPLIE (titre = l'idée, thème =
 * ce thème, marque = celle de la page). Anti-page-blanche : un clic pour
 * transformer une idée en vidéo à développer.
 */
function ExampleLauncher({
  brandId,
  themeName,
  items,
}: {
  brandId: string;
  themeName: string;
  items: string[];
}) {
  const [idea, setIdea] = React.useState<string | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <div
            key={i}
            dir="auto"
            className="group inline-flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/70 py-1 pe-1 ps-3 text-sm text-foreground/90"
          >
            <span>{it}</span>
            {/* Bouton révélé au survol (toujours visible sur mobile). */}
            <button
              type="button"
              onClick={() => setIdea(it)}
              title="En faire une vidéo"
              aria-label="En faire une vidéo"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-accent opacity-100 transition hover:bg-accent/15 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Video className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      {idea !== null && (
        <NewContentModal
          open={idea !== null}
          onOpenChange={(v) => !v && setIdea(null)}
          defaultTitle={idea}
          pillar={themeName}
          brandId={brandId}
        />
      )}
    </>
  );
}

/* ============================== Éditeur ============================== */

function PillarEditor({
  brandId,
  pillar,
  onDone,
}: {
  brandId: string;
  pillar: BrandPillar;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(pillar.name);
  const [objective, setObjective] = React.useState(pillar.objective ?? "");
  const [note, setNote] = React.useState(pillar.note ?? "");
  const [pct, setPct] = React.useState(
    pillar.share_pct != null ? String(pillar.share_pct) : "",
  );
  const [rubriques, setRubriques] = React.useState<string[]>(pillar.rubriques);
  const [examples, setExamples] = React.useState<string[]>(pillar.examples);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updatePillar(pillar.id, brandId, {
        name,
        objective,
        note,
        rubriques,
        examples,
        share_pct: pct.trim() === "" ? null : Number(pct),
      });
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        onDone();
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent/[0.03] p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <Label className="text-sm font-semibold">Nom du thème</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="auto"
            placeholder="🦶 Prévention & Conseils"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-semibold">Part (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="40"
            className="w-24"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-semibold">🎯 Objectif</Label>
        <Textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          dir="auto"
          placeholder="Ex : attirer une large audience grâce à des conseils simples et utiles."
          className="min-h-12 text-sm [field-sizing:content]"
        />
      </div>

      <StringListEditor
        label="✅ Rubriques"
        placeholder="Ex : La minute podologie"
        items={rubriques}
        onChange={setRubriques}
      />

      <StringListEditor
        label="💡 Exemples de vidéos"
        placeholder="Ex : Pourquoi il ne faut pas couper ses ongles trop courts."
        items={examples}
        onChange={setExamples}
      />

      <div className="space-y-1">
        <Label className="text-sm font-semibold">👉 Note</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          dir="auto"
          placeholder="Ex : c'est le contenu qui génère le plus de portée."
          className="min-h-12 text-sm [field-sizing:content]"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={pending}>
          <Check className="size-3.5" />
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Éditeur de liste de chaînes réutilisable (rubriques / exemples) :
 * saisie + Entrée pour ajouter, chip avec croix pour retirer.
 */
function StringListEditor({
  label,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = React.useState("");

  const add = () => {
    const t = value.trim();
    if (!t) return;
    if (!items.some((it) => it.toLowerCase() === t.toLowerCase())) {
      onChange([...items, t]);
    }
    setValue("");
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-center gap-1 rounded-lg border border-border bg-card ps-2.5 pe-1 py-1 text-sm"
              dir="auto"
            >
              <span>{it}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex size-5 items-center justify-center rounded-full text-muted transition hover:bg-destructive/10 hover:text-destructive"
                aria-label="Retirer"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          dir="auto"
          className="h-9 text-sm"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={add}
          disabled={!value.trim()}
          aria-label="Ajouter"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
