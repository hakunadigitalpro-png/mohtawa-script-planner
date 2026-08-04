"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { upsertBrandKit } from "@/app/(app)/brands/taxonomy-actions";
import type { BrandKit } from "@/lib/types";

/**
 * Brand Kit : identité de marque personnalisable (migration 0031).
 * Logo (upload atomique), palette de couleurs, slogan, audience, voix,
 * hashtags. L'audience + la voix serviront à personnaliser l'IA.
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
  const [tagline, setTagline] = React.useState(kit?.tagline ?? "");
  const [audience, setAudience] = React.useState(kit?.audience ?? "");
  const [voice, setVoice] = React.useState(kit?.voice ?? "");
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
        tagline: tagline.trim() || null,
        audience: audience.trim() || null,
        voice: voice.trim() || null,
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

      {/* Slogan */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Slogan / accroche de marque</Label>
        <Input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Ex : Des pieds en bonne santé, une vie plus légère."
          dir="auto"
        />
      </div>

      {/* Audience — nourrira l'IA */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">
          Audience cible{" "}
          <span className="text-xs font-normal text-accent">
            (utilisée par l&apos;IA)
          </span>
        </Label>
        <Textarea
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="Ex : femmes 30-50 ans qui ont mal aux pieds, diabétiques, sportifs du dimanche."
          dir="auto"
          className="min-h-16 text-sm [field-sizing:content]"
        />
      </div>

      {/* Voix — nourrira l'IA */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">
          Voix de marque (ton){" "}
          <span className="text-xs font-normal text-accent">
            (utilisée par l&apos;IA)
          </span>
        </Label>
        <Textarea
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          placeholder="Ex : chaleureux et rassurant, expert mais accessible, un peu d'humour, on tutoie."
          dir="auto"
          className="min-h-16 text-sm [field-sizing:content]"
        />
      </div>

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
