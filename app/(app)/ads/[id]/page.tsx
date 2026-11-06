import { redirect, notFound } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { PageHeader } from "@/components/page-header";
import { AdCampaignEditor } from "@/components/ads/ad-campaign-editor";
import { FullWidthBoost } from "@/components/full-width-boost";
import type { CampaignActivityRow } from "@/components/ads/campaign-activity";
import { fetchTeam } from "@/lib/brand-team";
import type {
  Ad,
  AdCampaign,
  AdCampaignMedia,
  AdCampaignComment,
  AdSet,
  AdSlide,
} from "@/lib/types-ads";

/**
 * Fiche d'une campagne : proposition en haut, suivi au milieu, résultats
 * en bas, fil de remarques (équipe + client) sur la droite. La marque
 * suit le contenu : si on tombe sur une campagne d'une autre marque, on
 * passe par /switch-brand comme pour les contenus (chantier 2).
 */

type CommentRow = AdCampaignComment & { user_id: string };

export default async function AdCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  // Seulement une chaîne de filtres : jamais une adresse où renvoyer quelqu'un.
  const { from } = await searchParams;
  const backHref = from && /^[\w=&%-]+$/.test(from) ? `/ads?${from}` : "/ads";
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect(`/login?next=/ads/${id}`);

  const { data: raw } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!raw) notFound();

  // Le statut suit les dates (0095) : à relire après le calcul, sinon la fiche
  // afficherait encore l'ancien.
  await supabase.rpc("recompute_ad_statuses", { p_brand_id: raw.brand_id });
  const { data: fresh } = await supabase
    .from("ad_campaigns")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const fullCampaign = { ...raw, status: fresh?.status ?? raw.status } as AdCampaign;

  const { active, role: brandRole } = await resolveActiveBrand();
  // Le responsable est un repère interne : son identifiant ne part pas vers un
  // client invité.
  const campaign =
    brandRole === "viewer" ? { ...fullCampaign, lead_id: null } : fullCampaign;
  if (!active || active.id !== campaign.brand_id) {
    redirect(`/switch-brand?to=${campaign.brand_id}&next=/ads/${id}`);
  }
  // Un viewer n'ouvre une fiche campagne que si le scope 'ads' lui a
  // été accordé par l'owner. Sinon, retour au calendrier (seule page
  // qui lui est garantie).
  if (brandRole === "viewer") {
    const { data: canSee } = await supabase.rpc("has_brand_scope", {
      b: campaign.brand_id,
      s: "ads",
    });
    if (!canSee) redirect("/calendar");
  }

  const [
    { data: mediaData },
    { data: commentData },
    { data: memberData },
    { data: adSetData },
    { data: adData },
    { data: slideData },
  ] = await Promise.all([
    supabase
      .from("ad_campaign_media")
      .select("*")
      .eq("campaign_id", id)
      .order("kind", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("ad_campaign_comments")
      .select("id, campaign_id, user_id, body, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: true }),
    supabase.rpc("list_brand_members_with_emails", {
      p_brand_id: campaign.brand_id,
    }),
    supabase
      .from("ad_sets")
      .select("*")
      .eq("campaign_id", id)
      .order("position", { ascending: true }),
    // Les ads sont filtrées par ad_set_id → on les charge pour tous les
    // ad_sets de cette campagne en un seul round-trip.
    supabase
      .from("ads")
      .select("*, ad_sets!inner(campaign_id)")
      .eq("ad_sets.campaign_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("ad_slides")
      .select("*, ads!inner(ad_set_id, ad_sets!inner(campaign_id))")
      .eq("ads.ad_sets.campaign_id", id)
      .order("position", { ascending: true }),
  ]);

  const media = (mediaData ?? []) as AdCampaignMedia[];
  const comments = (commentData ?? []) as CommentRow[];
  const members = (memberData ?? []) as Array<{
    user_id: string;
    email: string;
    role: string;
  }>;

  // Suggestions ad set : valeurs déjà utilisées sur les AUTRES campagnes
  // de la marque. Datalist côté <input> → la saisie du client complète
  // tout seul (« Canada », « 25-55 », « 30 », …) au lieu de retaper.
  const { data: suggRows } = await supabase
    .from("ad_sets")
    .select("targeting_age, targeting_location, targeting_interests, budget_daily, ad_campaigns!inner(brand_id)")
    .eq("ad_campaigns.brand_id", campaign.brand_id)
    .limit(500);
  const uniq = (xs: (string | null | undefined)[]) =>
    Array.from(new Set(xs.map((v) => (v ?? "").trim()).filter(Boolean))).sort();
  const adSetSuggestions = {
    ages: uniq(
      (suggRows ?? []).map(
        (r) => (r as { targeting_age: string | null }).targeting_age,
      ),
    ),
    locations: uniq(
      (suggRows ?? []).map(
        (r) => (r as { targeting_location: string | null }).targeting_location,
      ),
    ),
    interests: uniq(
      (suggRows ?? []).map(
        (r) =>
          (r as { targeting_interests: string | null }).targeting_interests,
      ),
    ),
    budgets: uniq(
      (suggRows ?? []).map(
        (r) => (r as { budget_daily: string | null }).budget_daily,
      ),
    ),
  };

  const adSetsFlat = (adSetData ?? []) as AdSet[];
  const adsFlat = ((adData ?? []) as (Ad & { ad_sets: unknown })[]).map(
    ({ ad_sets: _ad_sets, ...a }) => a as Ad,
  );
  const slidesFlat = ((slideData ?? []) as (AdSlide & { ads: unknown })[]).map(
    ({ ads: _ads, ...s }) => s as AdSlide,
  );
  const adSets = adSetsFlat.map((s) => ({
    ...s,
    ads: adsFlat
      .filter((a) => a.ad_set_id === s.id)
      .sort((a, b) => a.position - b.position)
      .map((a) => ({
        ...a,
        slides: slidesFlat
          .filter((sl) => sl.ad_id === a.id)
          .sort((a, b) => a.position - b.position),
      })),
  }));

  const emailByUser = new Map(members.map((m) => [m.user_id, m.email]));
  const commentsWithEmail = comments.map((c) => ({
    ...c,
    author_email: emailByUser.get(c.user_id) ?? "—",
  }));

  // Le rôle sur CETTE marque, pas sur la marque active au cookie — on vient
  // peut-être de basculer.
  const { data: myRole } = await supabase
    .from("brand_members")
    .select("role")
    .eq("brand_id", campaign.brand_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (myRole?.role as string | null) ?? null;
  const isWriter = role !== null && role !== "viewer";

  // Garde à l'envoi (règle contenus 0052/0058) : il faut un client invité
  // ET quelque chose à lui montrer. Sans ça le bouton « Soumettre »
  // deviendrait une pastille-instruction, comme pour les contenus.
  const hasClient = members.some((m) => m.role === "viewer");
  const visualCount = media.filter((m) => m.kind === "visual").length;

  const [team, activityRes] = isWriter
    ? await Promise.all([
        fetchTeam(supabase, campaign.brand_id),
        supabase.rpc("list_ad_campaign_activity", { p_campaign_id: id }),
      ])
    : [[], { data: [] }];
  const activity = (activityRes.data ?? []) as CampaignActivityRow[];

  return (
    <div className="space-y-6">
      <FullWidthBoost />
      <PageHeader
        eyebrow={active.name}
        title={campaign.title || "Campagne sans titre"}
        subtitle="Proposition de campagne, suivi et résultats"
        backHref={backHref}
        backLabel="Toutes les campagnes"
      />
      <AdCampaignEditor
        campaign={campaign}
        media={media}
        comments={commentsWithEmail}
        currentUserId={user.id}
        isWriter={isWriter}
        hasClient={hasClient}
        visualCount={visualCount}
        brandId={campaign.brand_id}
        adSets={adSets}
        adSetSuggestions={adSetSuggestions}
        team={team}
        activity={activity}
      />
    </div>
  );
}
