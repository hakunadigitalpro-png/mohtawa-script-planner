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
  addAdSlide,
  addAdToDefaultSet,
  deleteAd,
  deleteAdSet,
  deleteAdSlide,
  updateAdField,
  updateAdSetField,
  updateAdSlideField,
} from "@/app/(app)/ads/actions";
import type { Ad, AdSet, AdSlide } from "@/lib/types-ads";

type AdWithSlides = Ad & { slides: AdSlide[] };

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
type AdSetSuggestions = {
  ages: string[];
  locations: string[];
  interests: string[];
  budgets: string[];
};

export function AdSetsEditor({
  campaignId,
  adSets,
  canEdit,
  suggestions,
}: {
  campaignId: string;
  adSets: (AdSet & { ads: AdWithSlides[] })[];
  canEdit: boolean;
  /** Valeurs déjà utilisées sur d'autres campagnes de la marque,
   *  branchées en <datalist> pour auto-compléter. */
  suggestions?: AdSetSuggestions;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onAddSet = () => {
    startTransition(async () => {
      await addAdSet(campaignId);
      router.refresh();
    });
  };

  const onAddFirstAd = () => {
    startTransition(async () => {
      await addAdToDefaultSet(campaignId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Ad sets</h2>
          <p className="text-xs text-muted-foreground">
            Un ad set par audience / budget. Chaque ad set contient 1 à N
            publicités (visuels distincts pour tester).
          </p>
        </div>
        {canEdit && adSets.length > 0 && (
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
        <div className="space-y-3 rounded-2xl border border-dashed border-foreground/15 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Pas encore d&apos;ad. Ajoute-en une : un premier ad set sera créé
            automatiquement en reprenant le ciblage et le budget que tu as
            saisis plus haut.
          </p>
          {canEdit && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="accent"
                size="sm"
                onClick={onAddFirstAd}
                disabled={pending}
              >
                <Plus className="h-4 w-4" />
                Ajouter une ad
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddSet}
                disabled={pending}
              >
                <Plus className="h-4 w-4" />
                Ajouter un ad set vide
              </Button>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {adSets.map((s) => (
            <AdSetCard
              key={s.id}
              adSet={s}
              campaignId={campaignId}
              canEdit={canEdit}
              suggestions={suggestions}
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
  suggestions,
}: {
  adSet: AdSet & { ads: AdWithSlides[] };
  campaignId: string;
  canEdit: boolean;
  suggestions?: AdSetSuggestions;
}) {
  // Un id unique par ad set pour que chaque input pointe sur sa propre
  // datalist (deux datalists avec le même id = seul le premier compte).
  const dlId = React.useId();
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
                list={`${dlId}-ages`}
              />
            </Field>
            <Field label="Localisation">
              <Input
                defaultValue={adSet.targeting_location ?? ""}
                placeholder="Tunis…"
                onBlur={(e) => save("targeting_location", e.target.value)}
                disabled={!canEdit}
                className="h-9 text-sm"
                list={`${dlId}-locations`}
              />
            </Field>
            <Field label="Centres d'intérêt">
              <Input
                defaultValue={adSet.targeting_interests ?? ""}
                placeholder="Marketing…"
                onBlur={(e) => save("targeting_interests", e.target.value)}
                disabled={!canEdit}
                className="h-9 text-sm"
                list={`${dlId}-interests`}
              />
            </Field>
            <Field label="Budget / jour">
              <Input
                defaultValue={adSet.budget_daily ?? ""}
                placeholder="20 TND"
                onBlur={(e) => save("budget_daily", e.target.value)}
                disabled={!canEdit}
                className="h-9 text-sm"
                list={`${dlId}-budgets`}
              />
            </Field>
          </div>
          {/* Datalists partagées par cet ad set — alimentent l'autocomplétion
              de chaque input via l'attribut `list`. Elles tirent des
              valeurs déjà utilisées sur les AUTRES campagnes de la marque,
              pour que Mariam ne retape pas « Canada » dix fois. */}
          {suggestions && (
            <>
              <datalist id={`${dlId}-ages`}>
                {suggestions.ages.map((v) => <option key={v} value={v} />)}
              </datalist>
              <datalist id={`${dlId}-locations`}>
                {suggestions.locations.map((v) => <option key={v} value={v} />)}
              </datalist>
              <datalist id={`${dlId}-interests`}>
                {suggestions.interests.map((v) => <option key={v} value={v} />)}
              </datalist>
              <datalist id={`${dlId}-budgets`}>
                {suggestions.budgets.map((v) => <option key={v} value={v} />)}
              </datalist>
            </>
          )}
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
  ad: AdWithSlides;
  campaignId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

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

  const onAddSlide = () => {
    startTransition(async () => {
      await addAdSlide(ad.id, campaignId);
      router.refresh();
    });
  };

  // Les diapos à afficher : si des slides existent (carrousel), on les
  // montre et on ignore les champs legacy `visual_url`/`hook` de l'ad.
  // Sinon, on considère l'ad comme une seule carte (visuel + texte sur
  // l'ad elle-même) — pour que les ads existantes continuent de marcher
  // sans migration brutale.
  const hasSlides = ad.slides.length > 0;

  return (
    <li className="rounded-xl border border-foreground/10 bg-secondary/20 p-3">
      {/* Barre d'identité de l'ad */}
      <div className="mb-3 flex items-center justify-between gap-2">
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

      {/* Diapos : soit la seule carte legacy, soit la liste des slides. */}
      {hasSlides ? (
        <ul className="space-y-2">
          {ad.slides.map((s, i) => (
            <SlideRow
              key={s.id}
              slide={s}
              index={i}
              campaignId={campaignId}
              canEdit={canEdit}
            />
          ))}
        </ul>
      ) : (
        <SingleCardLegacy ad={ad} campaignId={campaignId} canEdit={canEdit} />
      )}

      {canEdit && (
        <button
          type="button"
          onClick={onAddSlide}
          disabled={pending}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-dashed border-foreground/20 bg-card px-3 py-1 text-xs font-semibold text-foreground/70 hover:border-accent/40 hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          {hasSlides ? "Ajouter une diapo" : "Transformer en carrousel"}
        </button>
      )}
    </li>
  );
}

/** Vue d'une ad à une seule carte (pas de slides) : visuel + texte sur
 *  les colonnes de l'ad elle-même. Converti en carrousel au premier
 *  ajout de slide — la carte legacy ne sera alors plus affichée. */
function SingleCardLegacy({
  ad,
  campaignId,
  canEdit,
}: {
  ad: AdWithSlides;
  campaignId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [visual, setVisual] = React.useState(ad.visual_url ?? null);

  const save = (field: Parameters<typeof updateAdField>[2], v: string | null) => {
    startTransition(async () => {
      await updateAdField(ad.id, campaignId, field, v);
    });
  };

  const onVisual = (url: string | null) => {
    setVisual(url);
    save("visual_url", url);
    router.refresh();
  };

  return (
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
        <VideoUrlField
          value={ad.video_url ?? null}
          onChange={(v) => save("video_url", v)}
          disabled={!canEdit}
        />
        <Textarea
          defaultValue={ad.hook ?? ""}
          placeholder="Texte principal de l'ad…"
          onBlur={(e) => save("hook", e.target.value || null)}
          disabled={!canEdit}
          rows={10}
          className="w-full resize-y text-sm leading-relaxed"
        />
      </div>
    </div>
  );
}

/**
 * Petit champ URL pour une vidéo de pub (Drive / YouTube / Vimeo).
 * Enregistre au blur, pas d'embed ici — on garde la fiche compacte,
 * le lien suffit pour cliquer et voir. L'icône signale ce qui est posé.
 */
function VideoUrlField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = React.useState(value ?? "");
  React.useEffect(() => {
    setLocal(value ?? "");
  }, [value]);
  return (
    <div className="flex items-center gap-2">
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const v = local.trim();
          if (v !== (value ?? "")) onChange(v || null);
        }}
        placeholder="🎬 Lien vidéo (Drive, YouTube, Vimeo)…"
        disabled={disabled}
        className="min-w-0 flex-1 text-xs"
      />
      {local && (
        <a
          href={local}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary"
          title="Ouvrir la vidéo"
        >
          Ouvrir ↗
        </a>
      )}
    </div>
  );
}

/** Une diapo d'un carrousel : visuel + son texte propre. */
function SlideRow({
  slide,
  index,
  campaignId,
  canEdit,
}: {
  slide: AdSlide;
  index: number;
  campaignId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [visual, setVisual] = React.useState(slide.visual_url ?? null);

  const save = (
    field: "visual_url" | "text" | "video_url",
    v: string | null,
  ) => {
    startTransition(async () => {
      await updateAdSlideField(slide.id, campaignId, field, v);
    });
  };

  const onVisual = (url: string | null) => {
    setVisual(url);
    save("visual_url", url);
    router.refresh();
  };

  const onDelete = () => {
    if (!confirm(`Supprimer la diapo ${index + 1} ?`)) return;
    startTransition(async () => {
      await deleteAdSlide(slide.id, campaignId);
      router.refresh();
    });
  };

  return (
    <li className="rounded-lg border border-foreground/10 bg-card p-2">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground/70">Diapo {index + 1}</span>
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer cette diapo"
            className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex items-start gap-3">
        <div className="w-24 shrink-0">
          {visual ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-black">
              <Image src={visual} alt="" fill sizes="96px" className="object-cover" />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onVisual(null)}
                  className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Retirer le visuel"
                >
                  <Trash2 className="h-2.5 w-2.5" />
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
          <VideoUrlField
            value={slide.video_url ?? null}
            onChange={(v) => save("video_url", v)}
            disabled={!canEdit}
          />
          <Textarea
            defaultValue={slide.text ?? ""}
            placeholder={`Texte de la diapo ${index + 1}…`}
            onBlur={(e) => save("text", e.target.value || null)}
            disabled={!canEdit}
            rows={10}
            className="w-full resize-y text-sm leading-relaxed"
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
