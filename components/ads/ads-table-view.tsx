import Link from "next/link";
import { AD_STATUS_LABEL } from "@/lib/types-ads";
import type { CampaignRow } from "@/components/ads/ads-views";

/**
 * Vue « Tableau » des campagnes, calquée sur la vue Notion de Mariam :
 * une ligne par campagne, colonnes Nom · Statut · Date · Thématique ·
 * Budget · Texte principal · Titre. Compacte, triable visuellement par
 * ordre chronologique (le même tri que le reste de l'app : date_start
 * croissant). Toute la ligne est cliquable → ouvre la fiche campagne.
 *
 * Pas d'édition en place pour V1 : on reste cohérent avec la vue
 * Planning (clic = ouvrir la fiche). L'édition en ligne viendra si
 * l'usage le justifie — ça impliquerait de surveiller N inputs
 * simultanés et de gérer leur conflit avec l'éditeur de fiche.
 */
type AdSetWithAds = {
  id: string;
  ads: {
    id: string;
    name: string | null;
    hook: string | null;
  }[];
};

/**
 * Couleur du fond de la pastille de statut, pareille que dans la vue
 * Planning — même langage visuel partout. Vert = En cours, rose =
 * Arrêtée, émeraude = Terminée, ambre = Validée, violet = Programmée,
 * neutre = Brouillon.
 */
function statusTone(status: string): string {
  const text = "!text-foreground";
  switch (status) {
    case "live":
      return `bg-emerald-200 dark:bg-emerald-500/30 ${text}`;
    case "completed":
      return `bg-teal-200 dark:bg-teal-500/30 ${text}`;
    case "stopped":
      return `bg-rose-200 dark:bg-rose-500/30 ${text}`;
    case "approved":
      return `bg-amber-200 dark:bg-amber-500/30 ${text}`;
    case "scheduled":
      return `bg-violet-200 dark:bg-violet-500/30 ${text}`;
    default:
      return `bg-foreground/10 ${text}`;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

export function AdsTableView({
  campaigns,
  adSetsByCampaign = {},
}: {
  campaigns: CampaignRow[];
  adSetsByCampaign?: Record<string, AdSetWithAds[]>;
}) {
  if (campaigns.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-foreground/15 bg-card p-8 text-center text-sm text-muted-foreground">
        Pas de campagne pour l&apos;instant.
      </p>
    );
  }

  // Colonnes fixes en pixels pour tenir le même rendu que Notion : le
  // tableau peut scroller horizontalement sur petit écran.
  const cols =
    "grid-cols-[minmax(220px,2fr)_120px_minmax(220px,1.5fr)_160px_90px_minmax(260px,2fr)_minmax(200px,1.5fr)]";

  return (
    <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-card">
      <div className="min-w-[1200px]">
        {/* En-tête */}
        <div
          className={`grid ${cols} gap-3 border-b border-foreground/10 bg-foreground/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground`}
        >
          <div>Nom</div>
          <div>Statut</div>
          <div>Date</div>
          <div>Thématique</div>
          <div>B. Global</div>
          <div>Texte principal</div>
          <div>Titre</div>
        </div>
        {/* Lignes */}
        {campaigns.map((c) => {
          // Première ad trouvée dans le premier ad set : son `hook`
          // (texte principal) et son `name` (titre de l'ad). Si pas
          // d'ad encore, on laisse —. Simple et prédictible, pas de
          // choix arbitraire entre plusieurs ads.
          const sets = adSetsByCampaign[c.id] ?? [];
          const firstAd = sets.flatMap((s) => s.ads)[0];
          return (
            <Link
              key={c.id}
              href={`/ads/${c.id}`}
              className={`grid ${cols} items-center gap-3 border-b border-foreground/5 px-4 py-3 text-sm transition last:border-b-0 hover:bg-foreground/[0.03]`}
            >
              <div className="truncate font-medium text-foreground">
                {c.title || "Sans titre"}
              </div>
              <div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(c.status)}`}
                >
                  {AD_STATUS_LABEL[c.status as keyof typeof AD_STATUS_LABEL] ??
                    c.status}
                </span>
              </div>
              <div className="text-foreground/80">
                {formatRange(c.date_start, c.date_end)}
              </div>
              <div>
                {c.theme ? (
                  <span className="inline-flex max-w-full truncate rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium !text-foreground dark:bg-amber-500/20">
                    {c.theme}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="text-foreground/80">
                {c.budget_global ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div
                className="line-clamp-2 whitespace-pre-wrap text-foreground/80"
                dir="auto"
              >
                {firstAd?.hook?.trim() || (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="truncate text-foreground/80">
                {firstAd?.name || (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
