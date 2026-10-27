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
import { AdsTableView } from "@/components/ads/ads-table-view";
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

type ViewMode = "planning" | "calendar" | "table";

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
  // Planning est le défaut. L'ancienne « Liste » redirige en silence.
  const view: ViewMode =
    params.view === "calendar"
      ? "calendar"
      : params.view === "table"
        ? "table"
        : "planning";

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month =
    params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : defaultMonth;

  const { data } = await supabase
    .from("ad_campaigns")
    .select(
      "id, brand_id, title, theme, platforms, budget_global, budget_daily, targeting_age, targeting_location, targeting_interests, date_start, date_end, status, review_state, evaluation",
    )
    .eq("brand_id", active.id)
    // Ordre manuel (0073) : on respecte le `position` posé par le
    // drag utilisateur. Pour les campagnes sans position (ne devrait
    // plus arriver depuis le backfill, mais filet), on retombe sur
    // la date de début croissante puis created_at.
    .order("position", { ascending: true, nullsFirst: false })
    .order("date_start", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const campaigns = (data ?? []) as CampaignRow[];

  let media: MediaRow[] = [];
  // Ad sets + ads par campagne pour la vue Planning. On veut l'ensemble
  // de la hiérarchie (ad set → ads avec visuel ET texte) pour afficher
  // vraiment ce qui va être diffusé, pas juste un compteur.
  const adSetsByCampaign: Record<
    string,
    {
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
    }[]
  > = {};
  // Commentaires ciblés (0066) sur photo/texte, chargés pour toutes les
  // campagnes affichées dans le Planning. Clé = "campaignId:type:id".
  const commentsByTargetPlanning: Record<
    string,
    { id: string; body: string; created_at: string; author_email: string }[]
  > = {};
  if ((view === "planning" || view === "table") && campaigns.length > 0) {
    const campaignIds = campaigns.map((c) => c.id);
    const [
      { data: mediaData },
      { data: adSetData },
      { data: adData },
      { data: slideData },
    ] = await Promise.all([
      supabase
        .from("ad_campaign_media")
        .select("campaign_id, kind, position, image_url")
        .in("campaign_id", campaignIds)
        .in("kind", ["visual"])
        .order("position", { ascending: true }),
      supabase
        .from("ad_sets")
        .select(
          "id, campaign_id, name, targeting_age, targeting_location, targeting_interests, budget_daily, position",
        )
        .in("campaign_id", campaignIds)
        .order("position", { ascending: true }),
      supabase
        .from("ads")
        .select(
          "id, name, hook, visual_url, position, ad_sets!inner(campaign_id, id)",
        )
        .in("ad_sets.campaign_id", campaignIds)
        .order("position", { ascending: true }),
      supabase
        .from("ad_slides")
        .select(
          "ad_id, visual_url, text, position, ads!inner(ad_set_id, ad_sets!inner(campaign_id))",
        )
        .in("ads.ad_sets.campaign_id", campaignIds)
        .order("position", { ascending: true }),
    ]);

    // Tous les commentaires (ciblés + globaux) pour les campagnes
    // affichées. Les globaux (target_type NULL) alimentent le fil
    // « sur toute la campagne » accessible depuis l'en-tête de carte.
    const { data: targetedComments } = await supabase
      .from("ad_campaign_comments")
      .select("id, campaign_id, user_id, body, created_at, target_type, target_id")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: true });
    // Résoudre les e-mails en une seule RPC par marque (ou en l'absence
    // de la RPC, on affiche juste l'id).
    const emails = new Map<string, string>();
    const brandIds = Array.from(new Set(campaigns.map((c) => c.brand_id)));
    for (const bid of brandIds) {
      const { data: members } = await supabase.rpc(
        "list_brand_members_with_emails",
        { p_brand_id: bid },
      );
      for (const m of (members ?? []) as { user_id: string; email: string }[]) {
        emails.set(m.user_id, m.email);
      }
    }
    for (const c of (targetedComments ?? []) as {
      id: string;
      campaign_id: string;
      user_id: string;
      body: string;
      created_at: string;
      target_type: string | null;
      target_id: string | null;
    }[]) {
      // Clé spéciale pour les commentaires globaux à la campagne :
      // `<campaignId>:global` — pas de target_id derrière.
      const key =
        c.target_type && c.target_id
          ? `${c.campaign_id}:${c.target_type}:${c.target_id}`
          : `${c.campaign_id}:global`;
      (commentsByTargetPlanning[key] ||= []).push({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        author_email: emails.get(c.user_id) ?? "—",
      });
    }
    media = (mediaData ?? []) as MediaRow[];

    // 1) poser les ad sets vides
    for (const s of (adSetData ?? []) as {
      id: string;
      campaign_id: string;
      name: string | null;
      targeting_age: string | null;
      targeting_location: string | null;
      targeting_interests: string | null;
      budget_daily: string | null;
    }[]) {
      const targeting = [
        s.targeting_age,
        s.targeting_location,
        s.targeting_interests,
      ]
        .filter(Boolean)
        .join(" · ");
      (adSetsByCampaign[s.campaign_id] ||= []).push({
        id: s.id,
        name: s.name,
        targeting,
        budget_daily: s.budget_daily,
        ads: [],
      });
    }
    // 2) y injecter les ads
    const slidesByAd: Record<
      string,
      { visual_url: string | null; text: string | null }[]
    > = {};
    for (const sl of (slideData ?? []) as {
      ad_id: string;
      visual_url: string | null;
      text: string | null;
    }[]) {
      (slidesByAd[sl.ad_id] ||= []).push({
        visual_url: sl.visual_url,
        text: sl.text,
      });
    }
    for (const a of (adData ?? []) as {
      id: string;
      name: string | null;
      hook: string | null;
      visual_url: string | null;
      ad_sets: { campaign_id: string; id: string } | { campaign_id: string; id: string }[];
    }[]) {
      const setRow = Array.isArray(a.ad_sets) ? a.ad_sets[0] : a.ad_sets;
      const cid = setRow?.campaign_id;
      const sid = setRow?.id;
      if (!cid || !sid) continue;
      const sets = adSetsByCampaign[cid];
      const set = sets?.find((s) => s.id === sid);
      if (set) {
        set.ads.push({
          id: a.id,
          name: a.name,
          hook: a.hook,
          visual_url: a.visual_url,
          slides: slidesByAd[a.id] ?? [],
        });
      }
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
                  {
                    v: "planning" as const,
                    href: monthHref("planning"),
                    label: "Planning",
                  },
                  {
                    v: "table" as const,
                    href: "/ads?view=table",
                    label: "Tableau",
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
      ) : view === "calendar" ? (
        <AdsCalendarView campaigns={campaigns} month={month} />
      ) : view === "table" ? (
        <AdsTableView
          campaigns={campaigns}
          adSetsByCampaign={adSetsByCampaign}
          commentsByTarget={commentsByTargetPlanning}
        />
      ) : (
        <AdsPlanningView
          campaigns={campaigns}
          media={media}
          adSetsByCampaign={adSetsByCampaign}
          commentsByTarget={commentsByTargetPlanning}
          brandId={active.id}
        />
      )}
    </div>
  );
}

