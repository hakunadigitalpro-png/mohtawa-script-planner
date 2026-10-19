"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  addAd,
  addAdSet,
  deleteAd,
  deleteAdSet,
  updateAdField,
  updateAdSetField,
} from "@/app/(app)/ads/actions";
import type { Ad, AdSet } from "@/lib/types-ads";

/**
 * Éditeur « Ad sets » d'une campagne — reproduit la hiérarchie Meta :
 *
 *   Campagne
 *     └ Ad set (ciblage + budget quotidien)
 *          └ Ad (visuel + hook)
 *
 * Autosave au blur sur tous les champs (même pattern que publications).
 * Les tables `ad_sets` et `ads` vivent dans la migration 0064 avec RLS
 * qui vérifie l'appartenance à la marque via la campagne parente.
 */
export function AdSetsEditor({
  campaignId,
  adSets,
  canEdit,
}: {
  campaignId: string;
  adSets: (AdSet & { ads: Ad[] })[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onAddSet = () => {
    startTransition(async () => {
      await addAdSet(campaignId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Ad sets</h2>
          <p className="text-xs text-muted-foreground">
            Un ad set par audience / budget. Chaque ad set contient 1 à N
            publicités (visuels distincts pour tester).
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddSet}
            disabled={pending}
          >
            <Plus className="h-4 w-4" />
            Ajouter un ad set
          </Button>
        )}
      </div>

      {adSets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 p-6 text-center text-sm text-muted-foreground">
          Aucun ad set pour l&apos;instant. Ajoute-en un pour y mettre tes
          audiences et tes visuels.
        </div>
      ) : (
        <ul className="space-y-3">
          {adSets.map((s) => (
            <AdSetCard
              key={s.id}
              adSet={s}
              campaignId={campaignId}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdSetCard({
  adSet,
  campaignId,
  canEdit,
}: {
  adSet: AdSet & { ads: Ad[] };
  campaignId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const save = (field: Parameters<typeof updateAdSetField>[2], v: string) => {
    startTransition(async () => {
      await updateAdSetField(adSet.id, campaignId, field, v || null);
    });
  };

  const onDelete = () => {
    if (!confirm(`Supprimer « ${adSet.name || "cet ad set"} » et ses ads ?`))
      return;
    startTransition(async () => {
      await deleteAdSet(adSet.id, campaignId);
      router.refresh();
    });
  };

  const onAddAd = () => {
    startTransition(async () => {
      await addAd(adSet.id, campaignId);
      router.refresh();
    });
  };

  return (
    <li className="rounded-2xl border border-foreground/10 bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-foreground/5 p-4">
        <div className="min-w-0 flex-1">
          <Input
            defaultValue={adSet.name ?? ""}
            placeholder="Nom de l'ad set"
            onBlur={(e) => save("name", e.target.value)}
            disabled={!canEdit}
            className="h-9 text-sm font-semibold"
          />
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
            <Field label="Âge">
              <Input
                defaultValue={adSet.targeting_age ?? ""}
                placeholder="25-55"
                onBlur={(e) => save("targeting_age", e.target.value)}
                disabled={!canEdit}
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Localisation">
              <Input
                defaultValue={adSet.targeting_location ?? ""}
                placeholder="Tunis…"
                onBlur={(e) => save("targeting_location", e.target.value)}
                disabled={!canEdit}
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Centres d'intérêt">
              <Input
                defaultValue={adSet.targeting_interests ?? ""}
                placeholder="Marketing…"
                onBlur={(e) => save("targeting_interests", e.target.value)}
                disabled={!canEdit}
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Budget / jour">
              <Input
                defaultValue={adSet.budget_daily ?? ""}
                placeholder="20 TND"
                onBlur={(e) => save("budget_daily", e.target.value)}
                disabled={!canEdit}
                className="h-9 text-sm"
              />
            </Field>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            title="Supprimer cet ad set"
            className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground/80">
            Ads · {adSet.ads.length}
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={onAddAd}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une ad
            </button>
          )}
        </div>
        {adSet.ads.length === 0 ? (
          <p className="rounded-xl border border-dashed border-foreground/10 p-3 text-center text-xs text-muted-foreground">
            Pas encore d&apos;ad dans ce groupe.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {adSet.ads.map((a) => (
              <AdCard
                key={a.id}
                ad={a}
                campaignId={campaignId}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function AdCard({
  ad,
  campaignId,
  canEdit,
}: {
  ad: Ad;
  campaignId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [visual, setVisual] = React.useState(ad.visual_url ?? null);

  const save = (field: Parameters<typeof updateAdField>[2], v: string | null) => {
    startTransition(async () => {
      await updateAdField(ad.id, campaignId, field, v);
    });
  };

  const onDelete = () => {
    if (!confirm(`Supprimer « ${ad.name || "cette ad"} » ?`)) return;
    startTransition(async () => {
      await deleteAd(ad.id, campaignId);
      router.refresh();
    });
  };

  const onVisual = (url: string | null) => {
    setVisual(url);
    save("visual_url", url);
    router.refresh();
  };

  return (
    <li className="rounded-xl border border-foreground/10 bg-secondary/20 p-3">
      <div className="flex items-start gap-3">
        <div className="w-28 shrink-0">
          {visual ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-black">
              <Image
                src={visual}
                alt=""
                fill
                sizes="112px"
                className="object-cover"
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onVisual(null)}
                  className="absolute end-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Retirer le visuel"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <ImageUpload
              contentId={`ad/${campaignId}`}
              value={null}
              aspectRatio="portrait"
              onChange={onVisual}
              label="+ Visuel"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Input
              defaultValue={ad.name ?? ""}
              placeholder="Nom de l'ad"
              onBlur={(e) => save("name", e.target.value || null)}
              disabled={!canEdit}
              className="h-9 text-sm font-semibold"
            />
            {canEdit && (
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                title="Supprimer cette ad"
                className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Textarea
            defaultValue={ad.hook ?? ""}
            placeholder="Hook / message principal…"
            onBlur={(e) => save("hook", e.target.value || null)}
            disabled={!canEdit}
            rows={3}
            className="text-sm"
          />
        </div>
      </div>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
