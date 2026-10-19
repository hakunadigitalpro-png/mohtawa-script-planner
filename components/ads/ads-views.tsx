import Link from "next/link";
import { CalendarDays, Target } from "lucide-react";
import { AD_STATUS_LABEL } from "@/lib/types-ads";

/**
 * Les deux vues alternatives à la liste simple :
 *   - Planning : cartes larges, un visuel principal + ciblage + période.
 *     L'oeil se pose sur la créa d'abord, les dates et le budget suivent.
 *   - Calendrier : grille mensuelle 7 colonnes ; chaque campagne est une
 *     bande colorée qui s'étire de date_start à date_end.
 *
 * Les deux sont des Server Components : elles reçoivent les données déjà
 * chargées par la page parent, pas de fetch ici.
 */

export type CampaignRow = {
  id: string;
  title: string;
  theme: string | null;
  platforms: string[];
  budget_global: string | null;
  budget_daily: string | null;
  targeting_age: string | null;
  targeting_location: string | null;
  targeting_interests: string | null;
  date_start: string | null;
  date_end: string | null;
  status: string;
  review_state: string | null;
  evaluation: string | null;
};

export type MediaRow = {
  campaign_id: string;
  kind: "visual" | "targeting" | "stats";
  position: number;
  image_url: string;
};

function statusLabel(s: string): string {
  return AD_STATUS_LABEL[s as keyof typeof AD_STATUS_LABEL] ?? s;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return "Pas de date";
  if (!end || end === start) return formatDay(start);
  return `${formatDay(start)} → ${formatDay(end)}`;
}

// =====================================================================
// Vue Planning : une carte large par campagne
// =====================================================================

export function AdsPlanningView({
  campaigns,
  media,
  adSetCountByCampaign = {},
  adsByCampaign = {},
}: {
  campaigns: CampaignRow[];
  media: MediaRow[];
  /** Nombre d'ad sets par campagne (compteur discret dans la carte). */
  adSetCountByCampaign?: Record<string, number>;
  /** Les ads de chaque campagne (nom + visuel) — mini-strip sous les métadonnées. */
  adsByCampaign?: Record<string, { name: string | null; visual_url: string | null }[]>;
}) {
  // On garde le PREMIER visuel de chaque campagne comme vignette principale.
  const firstVisualByCampaign = new Map<string, string>();
  const firstTargetingByCampaign = new Map<string, string>();
  for (const m of media) {
    if (m.kind === "visual" && !firstVisualByCampaign.has(m.campaign_id)) {
      firstVisualByCampaign.set(m.campaign_id, m.image_url);
    }
    if (m.kind === "targeting" && !firstTargetingByCampaign.has(m.campaign_id)) {
      firstTargetingByCampaign.set(m.campaign_id, m.image_url);
    }
  }

  if (campaigns.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-foreground/15 bg-card p-8 text-center text-sm text-muted-foreground">
        Pas de campagne pour l&apos;instant.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {campaigns.map((c) => {
        const visual = firstVisualByCampaign.get(c.id);
        const targeting = firstTargetingByCampaign.get(c.id);
        const targetingText = [
          c.targeting_age,
          c.targeting_location,
          c.targeting_interests,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={c.id}>
            <Link
              href={`/ads/${c.id}`}
              className="group grid gap-4 rounded-2xl border border-foreground/10 bg-card p-4 transition hover:border-accent/40 md:grid-cols-[180px_minmax(0,1fr)_200px]"
            >
              {visual ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={visual}
                  alt=""
                  className="h-32 w-full rounded-xl object-cover md:h-full"
                />
              ) : (
                <div className="grid h-32 w-full place-items-center rounded-xl bg-foreground/5 text-xs text-muted-foreground md:h-full">
                  Pas encore de visuel
                </div>
              )}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-foreground">
                    {c.title}
                  </h3>
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground">
                    {statusLabel(c.status)}
                  </span>
                  {c.review_state === "pending_review" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                      En attente du client
                    </span>
                  ) : null}
                </div>
                {c.theme ? (
                  <p className="text-xs text-muted-foreground">{c.theme}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatRange(c.date_start, c.date_end)}
                  </span>
                  {c.platforms.length > 0 ? (
                    <span>{c.platforms.join(" · ")}</span>
                  ) : null}
                  {c.budget_global ? (
                    <span>Budget {c.budget_global}</span>
                  ) : null}
                </div>
                {targetingText ? (
                  <p className="flex items-start gap-1.5 text-xs text-foreground/70">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{targetingText}</span>
                  </p>
                ) : null}
                {/* Structure Meta : compteur ad sets + mini-strip des
                    visuels d'ads (jusqu'à 4). Donne un aperçu sans forcer
                    à ouvrir la fiche. */}
                {(() => {
                  const ads = adsByCampaign[c.id] ?? [];
                  const setCount = adSetCountByCampaign[c.id] ?? 0;
                  if (setCount === 0 && ads.length === 0) return null;
                  return (
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-medium text-foreground/80">
                        {setCount} ad set{setCount > 1 ? "s" : ""} · {ads.length} ad
                        {ads.length > 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-1">
                        {ads.slice(0, 4).map((a, i) =>
                          a.visual_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={a.visual_url}
                              alt={a.name ?? ""}
                              className="h-7 w-7 rounded-md object-cover"
                            />
                          ) : (
                            <span
                              key={i}
                              className="h-7 w-7 rounded-md bg-foreground/5"
                              title={a.name ?? "Ad sans visuel"}
                            />
                          ),
                        )}
                        {ads.length > 4 && (
                          <span className="text-muted-foreground">
                            +{ads.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              {targeting ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={targeting}
                  alt="Capture du ciblage"
                  className="hidden h-full w-full rounded-xl object-cover md:block"
                />
              ) : (
                <div className="hidden place-items-center rounded-xl bg-foreground/5 text-xs text-muted-foreground md:grid">
                  Pas de capture
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// =====================================================================
// Vue Calendrier : grille mensuelle avec bandes
// =====================================================================

/**
 * Teintes des bandes de campagne — même palette sémantique que les pastilles
 * de statut sur `/ads`, mais en version plus posée pour tenir côte à côte
 * dans une case de calendrier sans crier.
 */
const BAND_TONE: Record<string, string> = {
  draft: "bg-foreground/10 text-foreground/80",
  approved: "bg-sky-200/70 text-sky-900 dark:bg-sky-500/25 dark:text-sky-100",
  scheduled:
    "bg-violet-200/70 text-violet-900 dark:bg-violet-500/25 dark:text-violet-100",
  live: "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-100",
  stopped: "bg-foreground/10 text-foreground/60 line-through",
};

export function AdsCalendarView({
  campaigns,
  month,
}: {
  campaigns: CampaignRow[];
  /** YYYY-MM — le mois à afficher. */
  month: string;
}) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const m0 = Number(monthStr) - 1; // 0..11
  const firstOfMonth = new Date(year, m0, 1);
  const lastOfMonth = new Date(year, m0 + 1, 0);

  // On démarre la grille au lundi qui précède (ou égale) le 1er du mois.
  const start = new Date(firstOfMonth);
  const dow = (start.getDay() + 6) % 7; // 0 = lundi
  start.setDate(start.getDate() - dow);

  // Grille de 6 semaines (42 jours) : couvre tous les cas.
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const prevMonth = new Date(year, m0 - 1, 1);
  const nextMonth = new Date(year, m0 + 1, 1);
  const monthHref = (d: Date) =>
    `/ads?view=calendar&month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // Index des campagnes par jour (YYYY-MM-DD) : une case affiche jusqu'à 3
  // bandes et un « +N » si plus.
  function iso(d: Date): string {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const byDay = new Map<string, CampaignRow[]>();
  for (const d of days) byDay.set(iso(d), []);
  for (const c of campaigns) {
    if (!c.date_start) continue;
    const s = new Date(c.date_start);
    const e = c.date_end ? new Date(c.date_end) : s;
    for (
      const cur = new Date(s);
      cur <= e;
      cur.setDate(cur.getDate() + 1)
    ) {
      const key = iso(cur);
      if (byDay.has(key)) byDay.get(key)!.push(c);
    }
  }

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const monthLabel = firstOfMonth.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const todayKey = iso(new Date());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize text-foreground">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1 text-xs">
          <Link
            href={monthHref(prevMonth)}
            className="rounded-full bg-foreground/5 px-3 py-1 text-foreground hover:bg-foreground/10"
          >
            ← Précédent
          </Link>
          <Link
            href={monthHref(new Date())}
            className="rounded-full bg-foreground/5 px-3 py-1 text-foreground hover:bg-foreground/10"
          >
            Aujourd&apos;hui
          </Link>
          <Link
            href={monthHref(nextMonth)}
            className="rounded-full bg-foreground/5 px-3 py-1 text-foreground hover:bg-foreground/10"
          >
            Suivant →
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-card">
        <div className="grid grid-cols-7 border-b border-foreground/10 bg-foreground/5 text-xs font-medium text-muted-foreground">
          {dayNames.map((d) => (
            <div key={d} className="px-2 py-1.5 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const inMonth = d.getMonth() === m0;
            const key = iso(d);
            const list = byDay.get(key) ?? [];
            const visible = list.slice(0, 3);
            const extra = list.length - visible.length;
            const isToday = key === todayKey;
            const isWeekStart = i % 7 === 0;
            return (
              <div
                key={key}
                className={`min-h-[88px] border-foreground/10 p-1.5 ${
                  i >= 7 ? "border-t" : ""
                } ${isWeekStart ? "" : "border-l"} ${
                  inMonth ? "" : "bg-foreground/[0.02]"
                }`}
              >
                <div
                  className={`mb-1 text-xs ${
                    isToday
                      ? "inline-grid h-5 w-5 place-items-center rounded-full bg-accent font-semibold text-accent-foreground"
                      : inMonth
                        ? "text-foreground/70"
                        : "text-foreground/30"
                  }`}
                >
                  {d.getDate()}
                </div>
                <div className="space-y-1">
                  {visible.map((c) => (
                    <Link
                      key={`${key}-${c.id}`}
                      href={`/ads/${c.id}`}
                      className={`block truncate rounded px-1.5 py-0.5 text-xs font-medium transition hover:opacity-80 ${
                        BAND_TONE[c.status] ?? "bg-foreground/10 text-foreground"
                      }`}
                      title={c.title}
                    >
                      {c.title}
                    </Link>
                  ))}
                  {extra > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      +{extra}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
