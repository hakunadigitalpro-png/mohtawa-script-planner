import { redirect, notFound } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { PageHeader } from "@/components/page-header";
import { AdCampaignEditor } from "@/components/ads/ad-campaign-editor";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect(`/login?next=/ads/${id}`);

  const { data: raw } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!raw) notFound();
  const campaign = raw as AdCampaign;

  const { active } = await resolveActiveBrand();
  if (!active || active.id !== campaign.brand_id) {
    redirect(`/switch-brand?to=${campaign.brand_id}&next=/ads/${id}`);
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
  const isWriter =
    role === "owner" || role === "admin" || role === "editor";

  // Garde à l'envoi (règle contenus 0052/0058) : il faut un client invité
  // ET quelque chose à lui montrer. Sans ça le bouton « Soumettre »
  // deviendrait une pastille-instruction, comme pour les contenus.
  const hasClient = members.some((m) => m.role === "viewer");
  const visualCount = media.filter((m) => m.kind === "visual").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={active.name}
        title={campaign.title || "Campagne sans titre"}
        subtitle="Proposition de campagne, suivi et résultats"
        backHref="/ads"
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
      />
    </div>
  );
}
