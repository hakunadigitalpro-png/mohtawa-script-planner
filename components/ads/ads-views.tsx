import Link from "next/link";
import { CalendarDays, Target } from "lucide-react";
import { AD_STATUS_LABEL } from "@/lib/types-ads";
import { PlanningAdCard } from "@/components/ads/planning-ad-card";
import { CampaignCommentsButton } from "@/components/ads/campaign-comments-button";

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
  brand_id: string;
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

/**
 * Couleur de la période affichée dans l'en-tête de carte, choisie
 * d'après le statut : d'un coup d'oeil on sait si c'est une campagne en
 * cours (vert), déjà arrêtée (rouge), validée côté client (ambre),
 * programmée (violet) ou encore en brouillon (neutre).
 */
function dateTone(status: string): string {
  // Texte toujours en noir (foreground), seul le fond change selon le
  // statut. `!text-foreground` force la couleur au-dessus du
  // `text-muted-foreground` hérité du parent.
  const text = "!text-foreground";
  switch (status) {
    case "live":
      return `bg-emerald-200 dark:bg-emerald-500/30 ${text}`;
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

// =====================================================================
// Vue Planning : une carte large par campagne
// =====================================================================

type AdSetWithAds = {
  id: string;
  name: string | null;
  targeting: string;
  budget_daily: string | null;
  ads: {
    id: string;
    name: string | null;
    hook: string | null;
    visual_url: string | null;
    slides: { visual_url: string | null; text: string | null }[];
  }[];
};

export function AdsPlanningView({
  campaigns,
  media,
  adSetsByCampaign = {},
  commentsByTarget = {},
}: {
  campaigns: CampaignRow[];
  media: MediaRow[];
  /** Les ad sets d'une campagne, chacun avec ses ads (visuel + texte). */
  adSetsByCampaign?: Record<string, AdSetWithAds[]>;
  /** Commentaires ciblés (0066). Clé : "campaignId:photo|text:targetId". */
  commentsByTarget?: Record<
    string,
    { id: string; body: string; created_at: string; author_email: string }[]
  >;
}) {
  // Legacy : visuels attachés à la campagne (avant la migration 0064). On
  // les garde en secours pour les campagnes qui n'ont pas encore d'ad.
  const firstVisualByCampaign = new Map<string, string>();
  for (const m of media) {
    if (m.kind === "visual" && !firstVisualByCampaign.has(m.campaign_id)) {
      firstVisualByCampaign.set(m.campaign_id, m.image_url);
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
        const adSets = adSetsByCampaign[c.id] ?? [];
        const legacyVisual = firstVisualByCampaign.get(c.id);
        const totalAds = adSets.reduce((n, s) => n + s.ads.length, 0);
        return (
          <li
            key={c.id}
            className="rounded-2xl border border-foreground/10 bg-card p-4 transition hover:border-accent/40"
          >
            {/* En-tête — infos de la campagne, cliquable → la fiche. */}
            <Link
              href={`/ads/${c.id}`}
              className="block space-y-2"
            >
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
                <CampaignCommentsButton
                  campaignId={c.id}
                  campaignTitle={c.title}
                  comments={commentsByTarget[`${c.id}:global`] ?? []}
                />
              </div>
              {c.theme ? (
                <p className="text-xs text-muted-foreground">{c.theme}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${dateTone(c.status)}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatRange(c.date_start, c.date_end)}
                </span>
                {c.platforms.length > 0 ? (
                  <span>{c.platforms.join(" · ")}</span>
                ) : null}
                {c.budget_global ? (
                  <span>Budget {c.budget_global}</span>
                ) : null}
                <span>
                  {adSets.length} ad set{adSets.length > 1 ? "s" : ""} ·{" "}
                  {totalAds} ad{totalAds > 1 ? "s" : ""}
                </span>
              </div>
            </Link>

            {/* Les ad sets, chacun avec SES ads (visuel + texte côte à
                côte). C'est ce qui va vraiment être diffusé — on le
                montre, on ne le résume plus en vignettes anonymes. */}
            {adSets.length > 0 ? (
              <div className="mt-3 space-y-3">
                {adSets.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-foreground/10 bg-secondary/20 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="font-semibold text-foreground">
                        {s.name ?? "Ad set"}
                      </span>
                      {s.targeting ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Target className="h-3 w-3" />
                          {s.targeting}
                        </span>
                      ) : null}
                      {s.budget_daily ? (
                        <span className="text-muted-foreground">
                          {s.budget_daily}/j
                        </span>
                      ) : null}
                    </div>
                    {s.ads.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-foreground/10 p-2 text-center text-xs text-muted-foreground">
                        Pas encore d&apos;ad dans ce groupe.
                      </p>
                    ) : (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {s.ads.map((a) => (
                          <PlanningAdCard
                            key={a.id}
                            campaignId={c.id}
                            ad={a}
                            commentsByTarget={commentsByTarget}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : legacyVisual ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-foreground/10 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={legacyVisual}
                  alt=""
                  className="h-20 w-16 rounded-md object-cover"
                />
                <p className="text-xs text-muted-foreground">
                  Visuel historique (campagne d&apos;avant la structure Ad
                  sets). Crée un ad set pour l&apos;organiser.
                </p>
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-foreground/10 p-3 text-center text-xs text-muted-foreground">
                Pas encore d&apos;ad.
              </p>
            )}
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
  month: string;
}) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const m0 = Number(monthStr) - 1;
  const firstOfMonth = new Date(year, m0, 1);

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));

  // 6 semaines de 7 jours.
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const dd = new Date(gridStart);
      dd.setDate(gridStart.getDate() + w * 7 + d);
      row.push(dd);
    }
    weeks.push(row);
  }

  function iso(d: Date): string {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const todayKey = iso(new Date());

  // Pour chaque campagne, on détermine ses « segments » : un segment par
  // semaine traversée, avec colonne de départ et nombre de jours. Puis on
  // assigne un « rail » par semaine en lecture gloutonne pour éviter les
  // chevauchements. Un rail = une ligne horizontale sous les numéros du
  // jour. Résultat : la bande s'étire sur plusieurs cases consécutives,
  // au lieu d'être recopiée dans chaque case.
  type Seg = { campaign: CampaignRow; weekIdx: number; startCol: number; span: number; isStart: boolean; isEnd: boolean };
  const segs: Seg[] = [];
  for (const c of campaigns) {
    if (!c.date_start) continue;
    const s = new Date(c.date_start);
    const e = c.date_end ? new Date(c.date_end) : s;
    // Normaliser à minuit
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    for (let w = 0; w < weeks.length; w++) {
      const weekStart = weeks[w][0];
      const weekEnd = weeks[w][6];
      if (e < weekStart || s > weekEnd) continue;
      const segStart = s < weekStart ? weekStart : s;
      const segEnd = e > weekEnd ? weekEnd : e;
      const startCol = Math.round(
        (segStart.getTime() - weekStart.getTime()) / (24 * 3600 * 1000),
      );
      const span = Math.round(
        (segEnd.getTime() - segStart.getTime()) / (24 * 3600 * 1000) + 1,
      );
      segs.push({
        campaign: c,
        weekIdx: w,
        startCol,
        span,
        isStart: iso(segStart) === iso(s),
        isEnd: iso(segEnd) === iso(e),
      });
    }
  }

  // Lane assignment par semaine : on trie par startCol puis par titre ;
  // chaque rail garde la dernière colonne occupée.
  const laneBySeg = new Map<Seg, number>();
  const lanesByWeek = new Array(weeks.length).fill(0) as number[];
  for (let w = 0; w < weeks.length; w++) {
    const weekSegs = segs
      .filter((s) => s.weekIdx === w)
      .sort((a, b) =>
        a.startCol - b.startCol ||
        a.campaign.title.localeCompare(b.campaign.title),
      );
    const laneEnds: number[] = [];
    for (const seg of weekSegs) {
      let lane = laneEnds.findIndex((end) => end <= seg.startCol);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = seg.startCol + seg.span;
      laneBySeg.set(seg, lane);
    }
    lanesByWeek[w] = laneEnds.length;
  }

  const prevMonth = new Date(year, m0 - 1, 1);
  const nextMonth = new Date(year, m0 + 1, 1);
  const monthHref = (d: Date) =>
    `/ads?view=calendar&month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const monthLabel = firstOfMonth.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const LANE_H = 20; // px — hauteur d'un rail
  const LANE_GAP = 4;
  const HEADER_H = 24; // la zone avec le numéro du jour
  const MIN_CELL = 90;

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

        {weeks.map((row, w) => {
          const weekSegs = segs.filter((s) => s.weekIdx === w);
          const laneCount = lanesByWeek[w];
          const bandsHeight = laneCount * (LANE_H + LANE_GAP);
          const rowHeight = Math.max(MIN_CELL, HEADER_H + bandsHeight + 8);
          return (
            <div
              key={w}
              className="relative grid grid-cols-7"
              style={{ height: `${rowHeight}px` }}
            >
              {/* Cases : numéros du jour + fond + bordures */}
              {row.map((d, di) => {
                const key = iso(d);
                const inMonth = d.getMonth() === m0;
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={`relative border-foreground/10 p-1.5 ${
                      w > 0 ? "border-t" : ""
                    } ${di > 0 ? "border-l" : ""} ${
                      inMonth ? "" : "bg-foreground/[0.02]"
                    }`}
                  >
                    <div
                      className={`text-xs ${
                        isToday
                          ? "inline-grid h-5 w-5 place-items-center rounded-full bg-accent font-semibold text-accent-foreground"
                          : inMonth
                            ? "text-foreground/70"
                            : "text-foreground/30"
                      }`}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
              {/* Bandes continues superposées — une bande par (campagne,
                  semaine), étirée sur ses colonnes. */}
              {weekSegs.map((seg) => {
                const lane = laneBySeg.get(seg) ?? 0;
                const leftPct = (seg.startCol / 7) * 100;
                const widthPct = (seg.span / 7) * 100;
                const top = HEADER_H + lane * (LANE_H + LANE_GAP);
                const rounded = `${seg.isStart ? "rounded-l-full" : ""} ${seg.isEnd ? "rounded-r-full" : ""}`;
                return (
                  <Link
                    key={`${seg.campaign.id}-${seg.weekIdx}-${seg.startCol}`}
                    href={`/ads/${seg.campaign.id}`}
                    title={`${seg.campaign.title} · ${formatRange(seg.campaign.date_start, seg.campaign.date_end)}`}
                    className={`absolute flex items-center overflow-hidden truncate px-2 text-[11px] font-medium transition hover:opacity-80 ${
                      BAND_TONE[seg.campaign.status] ??
                      "bg-foreground/10 text-foreground"
                    } ${rounded}`}
                    style={{
                      top: `${top}px`,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      height: `${LANE_H}px`,
                    }}
                  >
                    {seg.isStart ? seg.campaign.title : " "}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
