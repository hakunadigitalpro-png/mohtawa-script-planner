"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { upsertBrandKit } from "@/app/(app)/brands/taxonomy-actions";
import type { BrandKit } from "@/lib/types";

/**
 * Identité de marque : le LOGO est la seule chose demandée ici, parce que
 * c'est la seule que l'app utilise réellement (avatar de la marque).
 *
 * Ce qui a été retiré, et pourquoi :
 *  - Palette de couleurs : rien ne la consommait — pas de génération
 *    d'image, pas d'affichage, pas d'export. Demander une info inutilisée.
 *  - Hashtags : maintenant produits par la Stratégie de contenu et
 *    réutilisés dans les légendes générées.
 *  - Slogan / audience / voix : produits par la stratégie eux aussi.
 *
 * Tout ce qui vient de la stratégie est affiché en lecture seule — une
 * seule source de vérité, jamais de double saisie.
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
  const [, startTransition] = React.useTransition();

  // Le logo se sauvegarde tout seul dès l'upload (action atomique) — il n'y
  // a plus aucun autre champ, donc plus de bouton « Enregistrer ».
  const onLogo = (url: string | null) => {
    setLogoUrl(url);
    startTransition(async () => {
      await upsertBrandKit(brandId, { logo_url: url });
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
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
        <p className="text-xs text-muted">
          Il remplace l&apos;initiale de ta marque partout dans l&apos;app.
        </p>
      </div>

      <StrategyDerived kit={kit} />
    </div>
  );
}

/**
 * Slogan / audience / voix / hashtags, en LECTURE SEULE : ils viennent de la
 * Stratégie de contenu et s'y modifient. Quand il n'y a pas encore de
 * stratégie, on n'affiche RIEN — pas de message expliquant la plomberie
 * interne de l'app, ça ne parle qu'à nous.
 */
function StrategyDerived({ kit }: { kit: BrandKit | null }) {
  const rows = [
    { label: "Slogan", value: kit?.tagline },
    { label: "Audience", value: kit?.audience },
    { label: "Voix", value: kit?.voice },
  ].filter((r) => r.value?.trim());

  const hashtags = (kit?.hashtags ?? []).filter((h) => h.trim());
  if (rows.length === 0 && hashtags.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-accent/25 bg-accent/5 px-4 py-3.5">
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

      {hashtags.length > 0 && (
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Hashtags
          </dt>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {hashtags.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-card px-2 py-0.5 text-xs"
                dir="auto"
              >
                #{h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
