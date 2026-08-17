import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { KreaBadge } from "@/components/krea-avatar";
import { NewContentButton } from "@/components/new-content-modal";
import { cn } from "@/lib/utils";

/**
 * Checklist de parcours calculée sur les vraies données de la marque (pas du
 * texte statique) — remplace la visite guidée ponctuelle par une présence
 * qui reste tant que le parcours n'est pas terminé. Zéro appel IA : juste
 * des booléens dérivés de requêtes déjà en base.
 */
export async function KreaProgressPanel({
  brandId,
  hasThemes,
  hasContent,
  hasPublished,
}: {
  brandId: string;
  hasThemes: boolean;
  hasContent: boolean;
  hasPublished: boolean;
}) {
  const t = await getTranslations("dashboard.progress");

  return (
    <Card className="p-5">
      <KreaBadge className="mb-3" />
      <ul className="space-y-3">
        <Step done label={t("brand")} />
        <Step
          done={hasThemes}
          label={t("themes")}
          hint={t("themesHint")}
          cta={
            !hasThemes && (
              <Link
                href={`/brands/${brandId}`}
                className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3.5 text-xs font-semibold hover:bg-secondary"
              >
                {t("themesCta")}
              </Link>
            )
          }
        />
        <Step
          done={hasContent}
          label={t("content")}
          hint={t("contentHint")}
          cta={!hasContent && <NewContentButton variant="outline" label={t("contentCta")} />}
        />
        <Step done={hasPublished} label={t("publish")} hint={t("publishHint")} />
      </ul>
    </Card>
  );
}

function Step({
  done,
  label,
  hint,
  cta,
}: {
  done: boolean;
  label: string;
  hint?: string;
  cta?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      {done ? (
        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", done && "text-muted line-through")}>
          {label}
        </p>
        {!done && hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        {cta && <div className="mt-1.5">{cta}</div>}
      </div>
    </li>
  );
}
