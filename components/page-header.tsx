import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * En-tête de page : bloc sombre à halos orange, validé sur le Dashboard puis
 * généralisé. Défini UNE fois ici — retoucher le langage visuel des pages se
 * fait à un seul endroit, pas dans huit fichiers.
 *
 * Le conteneur `actions` force `text-foreground` : ce sont des contrôles posés
 * sur des pastilles claires (`bg-card`), et sans ça ils héritent le blanc du
 * bandeau — texte blanc sur pastille blanche, donc illisible. Un bouton qui
 * veut du blanc le déclare lui-même (`accent`, `destructive`…).
 *
 * Attention quand même au variant `default` : il est en ink, donc invisible
 * sur ce fond. Utiliser `accent` ou `outline`.
 *
 * Idem pour `meta` : le contenu est rendu tel quel, donc toute couleur de
 * texte doit être explicitement claire (`text-white/70`, pas `text-muted`).
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  actionsClassName,
  backHref,
  backLabel,
  aside,
  className,
}: {
  /** Petite ligne au-dessus du titre (nom de la marque, contexte…). */
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Ligne libre sous le titre (badges de statut, format, plateforme…). */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Classes du conteneur d'actions — ex. `w-full` pour une barre d'outils. */
  actionsClassName?: string;
  /** Lien de retour rendu au-dessus du titre, dans l'en-tête. */
  backHref?: string;
  backLabel?: string;
  /**
   * Rendu à l'opposé du lien de retour, sur la même ligne : la navigation
   * entre pages voisines. Elle appartient à cette ligne-là et pas à celle
   * des actions — se déplacer n'est pas agir sur le contenu affiché.
   * Rendu tel quel sur fond sombre : la couleur du texte doit être explicite.
   */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-hero rounded-3xl p-6 shadow-lift sm:p-8",
        className,
      )}
    >
      {(backHref || aside) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex min-w-0 items-center gap-1 text-sm text-white/70 transition hover:text-white"
            >
              <ArrowLeft className="size-4 shrink-0 rtl-flip" />
              {/* Tronqué plutôt que replié : à côté du pager, « Retour au
                  calendrier » se cassait en deux lignes sur un téléphone et
                  déséquilibrait tout le haut du bandeau. */}
              <span className="truncate">{backLabel}</span>
            </Link>
          ) : (
            <span />
          )}
          {aside}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p
              className="truncate text-xs font-bold uppercase tracking-[0.18em] text-orange-soft"
              dir="auto"
            >
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-white/70" dir="auto">
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-3">{meta}</div>}
        </div>
        {actions && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 text-foreground",
              actionsClassName,
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
