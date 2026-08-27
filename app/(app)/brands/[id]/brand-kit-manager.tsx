"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { upsertBrandKit } from "@/app/(app)/brands/taxonomy-actions";
import type { BrandKit } from "@/lib/types";

/**
 * Identité VISUELLE de la marque (migration 0031) : logo, palette, hashtags.
 *
 * Ne demande volontairement PAS l'audience, la voix ni le slogan : ces trois
 * champs sont produits par la Stratégie de contenu et propagés
 * automatiquement (applyBrandStrategy). Les redemander ici serait une double
 * saisie de la même information — ils sont juste affichés en lecture seule.
 */
export function BrandKitManager({
  brandId,
  kit,
}: {
  brandId: string;
  kit: BrandKit | null;
}) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = React.useState(kit?.logo_url ?? null);
  const [primary, setPrimary] = React.useState(kit?.color_primary ?? "#FF6B35");
  const [secondary, setSecondary] = React.useState(
    kit?.color_secondary ?? "#9C7DD8",
  );
  const [accent, setAccent] = React.useState(kit?.color_accent ?? "#14B8A6");
  const [hashtags, setHashtags] = React.useState<string[]>(kit?.hashtags ?? []);
  const [tagInput, setTagInput] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);

  // Le logo se sauvegarde tout seul dès l'upload (action atomique).
  const onLogo = (url: string | null) => {
    setLogoUrl(url);
    startTransition(async () => {
      await upsertBrandKit(brandId, { logo_url: url });
      router.refresh();
    });
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    if (!hashtags.some((h) => h.toLowerCase() === t.toLowerCase())) {
      setHashtags([...hashtags, t]);
    }
    setTagInput("");
  };

  const save = () => {
    setSaved(false);
    startTransition(async () => {
      await upsertBrandKit(brandId, {
        color_primary: primary,
        color_secondary: secondary,
        color_accent: accent,
        hashtags,
      });
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {/* Logo + palette */}
      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Logo</Label>
          <div className="w-32">
            <ImageUpload
              folder={`brand/${brandId}`}
              value={logoUrl}
              onChange={onLogo}
              aspectRatio="square"
              label="Ajouter le logo"
              compress="keep-format"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Palette de couleurs</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            <ColorField label="Principale" value={primary} onChange={setPrimary} />
            <ColorField
              label="Secondaire"
              value={secondary}
              onChange={setSecondary}
            />
            <ColorField label="Accent" value={accent} onChange={setAccent} />
          </div>
        </div>
      </div>

      {/* Issu de la stratégie — jamais ressaisi ici (lecture seule). */}
      <StrategyDerived kit={kit} />

      {/* Hashtags */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Hashtags récurrents</Label>
        {hashtags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {hashtags.map((h, i) => (
              <li
                key={i}
                className="flex items-center gap-1 rounded-lg border border-border bg-card py-1 ps-2.5 pe-1 text-sm"
                dir="auto"
              >
                <span>#{h}</span>
                <button
                  type="button"
                  onClick={() =>
                    setHashtags(hashtags.filter((_, idx) => idx !== i))
                  }
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
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Ex : podologie"
            className="h-9 text-sm"
            dir="auto"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={addTag}
            disabled={!tagInput.trim()}
            aria-label="Ajouter le hashtag"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Enregistrer (le logo est déjà sauvé à l'upload) */}
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          <Check className="size-4" />
          {pending ? "Enregistrement…" : "Enregistrer l'identité"}
        </Button>
        {saved && !pending && (
          <span className="text-sm font-medium text-emerald-700">
            ✓ Enregistré
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Slogan / audience / voix, en LECTURE SEULE : ils viennent de la Stratégie
 * de contenu et s'y modifient (une seule source de vérité). Affichés ici
 * parce qu'ils font partie de l'identité — mais jamais redemandés.
 */
function StrategyDerived({ kit }: { kit: BrandKit | null }) {
  const rows = [
    { label: "Slogan", value: kit?.tagline },
    { label: "Audience cible", value: kit?.audience },
    { label: "Voix de marque", value: kit?.voice },
  ].filter((r) => r.value?.trim());

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 px-4 py-3">
        <p className="text-sm text-muted">
          Ton slogan, ton audience et ta voix de marque apparaîtront ici
          automatiquement dès que tu auras créé ta{" "}
          <span className="font-semibold text-foreground">
            stratégie de contenu
          </span>{" "}
          (en haut de la page). Rien à saisir deux fois.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-2xl border border-accent/25 bg-accent/5 px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
          Issu de ta stratégie
        </span>
      </div>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {r.label}
            </dt>
            <dd className="text-sm leading-relaxed" dir="auto">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        Pour les modifier, ajuste ta stratégie de contenu en haut de la page.
      </p>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 font-mono text-xs uppercase"
        />
      </div>
    </div>
  );
}
