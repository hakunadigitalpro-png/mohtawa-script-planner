import { redirect } from "next/navigation";
import Link from "next/link";
import { Megaphone, Plus, CalendarDays } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
// import { ViewTab, ViewTabs } from "@/components/ui/view-tabs"; // debug : écarté
import { AD_STATUS_LABEL } from "@/lib/types-ads";
import {
  AdsPlanningView,
  AdsCalendarView,
  type CampaignRow,
  type MediaRow,
} from "@/components/ads/ads-views";
import { AdCardDelete } from "@/components/ads/ad-card-delete";

/**
 * Trois façons de regarder les mêmes campagnes :
 *   - « Liste » (défaut) — groupée par mois, pastilles de statut.
 *   - « Planning » — grosses cartes avec visuel + ciblage + période.
 *   - « Calendrier » — vue mois, bandes qui s'étirent sur la période.
 *
 * La création passe par un simple <Link> vers `/ads/new` plutôt qu'un
 * <form action={serverAction}> : le combo PageHeader + form d'action
 * serveur cassait le rendu sous Next 16 dans l'App Router.
 */

const STATUS_TONE: Record<string, string> = {
  draft: "bg-foreground/5 text-foreground",
  approved: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
  scheduled:
    "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200",
  live: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  stopped: "bg-foreground/10 text-foreground",
};

type ViewMode = "list" | "planning" | "calendar";

function monthKey(iso: string | null): string {
  if (!iso) return "Sans date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sans date";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return "";
  const sStr = s.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  if (!end || end === start) return sStr;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return sStr;
  const eStr = e.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return `${sStr} → ${eStr}`;
}

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const { active, role } = await resolveActiveBrand();
  if (role === "viewer") redirect("/calendar");
  if (!active) redirect("/dashboard");

  const params = await searchParams;
  const view: ViewMode =
    params.view === "planning" || params.view === "calendar"
      ? params.view
      : "list";

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month =
    params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : defaultMonth;

  const { data } = await supabase
    .from("ad_campaigns")
    .select(
      "id, title, theme, platforms, budget_global, budget_daily, targeting_age, targeting_location, targeting_interests, date_start, date_end, status, review_state, evaluation",
    )
    .eq("brand_id", active.id)
    .order("date_start", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const campaigns = (data ?? []) as CampaignRow[];

  let media: MediaRow[] = [];
  // Ads par campagne, pour la vue Planning (compteurs + bande de visuels).
  // On ne charge que ce qu'il faut : id, nom, visuel, set parent.
  let adsByCampaign: Record<string, { name: string | null; visual_url: string | null }[]> = {};
  let adSetsByCampaign: Record<string, number> = {};
  if (view === "planning" && campaigns.length > 0) {
    const campaignIds = campaigns.map((c) => c.id);
    const [{ data: mediaData }, { data: adSetData }, { data: adData }] =
      await Promise.all([
        supabase
          .from("ad_campaign_media")
          .select("campaign_id, kind, position, image_url")
          .in("campaign_id", campaignIds)
          .in("kind", ["visual", "targeting"])
          .order("position", { ascending: true }),
        supabase
          .from("ad_sets")
          .select("id, campaign_id")
          .in("campaign_id", campaignIds),
        // Les ads sont filtrées par ad_set → on joint pour retrouver la
        // campagne, et on les tri par position pour que la 1re d'un set
        // donne sa vignette.
        supabase
          .from("ads")
          .select("name, visual_url, position, ad_sets!inner(campaign_id)")
          .in("ad_sets.campaign_id", campaignIds)
          .order("position", { ascending: true }),
      ]);
    media = (mediaData ?? []) as MediaRow[];
    for (const s of (adSetData ?? []) as { campaign_id: string }[]) {
      adSetsByCampaign[s.campaign_id] = (adSetsByCampaign[s.campaign_id] ?? 0) + 1;
    }
    for (const a of (adData ?? []) as {
      name: string | null;
      visual_url: string | null;
      ad_sets: { campaign_id: string } | { campaign_id: string }[];
    }[]) {
      const setRow = Array.isArray(a.ad_sets) ? a.ad_sets[0] : a.ad_sets;
      const cid = setRow?.campaign_id;
      if (!cid) continue;
      (adsByCampaign[cid] ||= []).push({ name: a.name, visual_url: a.visual_url });
    }
  }

  const monthHref = (v: ViewMode) =>
    v === "calendar" ? `/ads?view=calendar&month=${month}` : `/ads?view=${v}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={active.name}
        title="Publicités"
        subtitle="Les propositions de campagnes et leurs résultats."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* ViewTabs retirés temporairement — debug du crash SSR. Les
                vues restent accessibles par URL : /ads, /ads?view=planning,
                /ads?view=calendar */}
            <div className="inline-flex gap-0.5 rounded-full border border-white/20 bg-white/10 p-0.5 backdrop-blur-sm">
              {(
                [
                  { v: "list" as const, href: "/ads", label: "Liste" },
                  {
                    v: "planning" as const,
                    href: monthHref("planning"),
                    label: "Planning",
                  },
                  {
                    v: "calendar" as const,
                    href: monthHref("calendar"),
                    label: "Calendrier",
                  },
                ]
              ).map(({ v, href, label }) => (
                <Link
                  key={v}
                  href={href}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                    view === v
                      ? "bg-white text-foreground shadow-sm"
                      : "text-white hover:bg-white/15"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
            {/* <form method="POST"> plutôt qu'un <Link> : Next préfetchait
                les liens visibles et appelait /ads/new à chaque affichage
                de /ads, créant une campagne brouillon à chaque refresh. */}
            <form action="/ads/new" method="post">
              <Button
                type="submit"
                variant={campaigns.length === 0 ? "outline" : "accent"}
              >
                <Plus className="h-4 w-4" />
                Nouvelle campagne
              </Button>
            </form>
          </div>
        }
      />

      {campaigns.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-foreground/15 bg-card p-10 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-foreground/40" />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            Pas encore de campagne
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Une campagne regroupe la proposition que tu montres au client
            (ciblage, visuels, budget) et les résultats une fois diffusée.
          </p>
          <form action="/ads/new" method="post" className="mt-4 inline-block">
            <Button type="submit" variant="accent">
              <Plus className="h-4 w-4" />
              Créer la première
            </Button>
          </form>
        </div>
      ) : view === "planning" ? (
        <AdsPlanningView
          campaigns={campaigns}
          media={media}
          adSetCountByCampaign={adSetsByCampaign}
          adsByCampaign={adsByCampaign}
        />
      ) : view === "calendar" ? (
        <AdsCalendarView campaigns={campaigns} month={month} />
      ) : (
        <ListView campaigns={campaigns} />
      )}
    </div>
  );
}

// =====================================================================
// Vue Liste (défaut) — groupée par mois
// =====================================================================

function ListView({ campaigns }: { campaigns: CampaignRow[] }) {
  const groups = new Map<string, CampaignRow[]>();
  for (const c of campaigns) {
    const k = monthKey(c.date_start);
    const list = groups.get(k) ?? [];
    list.push(c);
    groups.set(k, list);
  }
  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([month, rows]) => (
        <section key={month} className="space-y-3">
          <h2 className="text-sm font-semibold capitalize text-muted-foreground">
            {month}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {rows.map((c) => {
              const platforms = Array.isArray(c.platforms) ? c.platforms : [];
              return (
                <li key={c.id} className="group relative">
                  <AdCardDelete
                    campaignId={c.id}
                    title={c.title || "Sans titre"}
                  />
                  <Link
                    href={`/ads/${c.id}`}
                    className="block rounded-2xl border border-foreground/10 bg-card p-4 pe-12 transition hover:border-accent/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-foreground">
                          {c.title || "Sans titre"}
                        </h3>
                        {c.theme ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {c.theme}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_TONE[c.status] ?? "bg-foreground/5"
                        }`}
                      >
                        {AD_STATUS_LABEL[
                          c.status as keyof typeof AD_STATUS_LABEL
                        ] ?? c.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.date_start ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatRange(c.date_start, c.date_end)}
                        </span>
                      ) : null}
                      {c.budget_global ? (
                        <span>Budget {c.budget_global}</span>
                      ) : null}
                      {platforms.length > 0 ? (
                        <span>{platforms.join(" · ")}</span>
                      ) : null}
                      {c.review_state === "pending_review" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                          En attente du client
                        </span>
                      ) : null}
                      {c.review_state === "needs_revision" ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-900 dark:bg-rose-500/20 dark:text-rose-200">
                          À retravailler
                        </span>
                      ) : null}
                      {c.evaluation ? (
                        <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-medium">
                          Résultat :{" "}
                          {c.evaluation === "good"
                            ? "bon"
                            : c.evaluation === "average"
                              ? "moyen"
                              : "faible"}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
