import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clapperboard, Layers, Palette, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PillarManager } from "./pillar-manager";
import { ThemeAssistant } from "./theme-assistant";
import { GuidedTour } from "./guided-tour";
import { ScenePresetManager } from "./scene-preset-manager";
import { BrandKitManager } from "./brand-kit-manager";
import { BrandStudio } from "./brand-studio";
import { TeamSection } from "./team-section";
import type { BrandRole } from "../team-actions";
import type { BrandPillar, ScenePreset, BrandKit, BrandStrategy } from "@/lib/types";

type MemberRow = {
  user_id: string;
  email: string;
  role: BrandRole;
  joined_at: string;
};

type InvitationRow = {
  id: string;
  role: BrandRole;
  token: string;
  note: string | null;
  created_at: string;
  expires_at: string;
};

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!brand) notFound();

  const [
    pillarsRes,
    scenePresetsRes,
    kitRes,
    strategyRes,
    membersRes,
    invitationsRes,
    selfMembershipRes,
  ] = await Promise.all([
    supabase
      .from("brand_pillars")
      .select("id, name, objective, rubriques, examples, note, share_pct")
      .eq("brand_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("brand_scene_presets")
      .select("*")
      .eq("brand_id", id)
      .order("position", { ascending: true }),
    supabase.from("brand_kits").select("*").eq("brand_id", id).maybeSingle(),
    supabase
      .from("brand_strategies")
      .select("*")
      .eq("brand_id", id)
      .maybeSingle(),
    supabase.rpc("list_brand_members_with_emails", { p_brand_id: id }),
    supabase
      .from("brand_invitations")
      .select("id, role, token, note, created_at, expires_at")
      .eq("brand_id", id)
      .is("used_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_members")
      .select("role")
      .eq("brand_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const pillars = (pillarsRes.data ?? []) as BrandPillar[];
  const scenePresets = (scenePresetsRes.data ?? []) as ScenePreset[];
  const kit = (kitRes.data ?? null) as BrandKit | null;
  const strategy = (strategyRes.data ?? null) as BrandStrategy | null;
  const members = (membersRes.data ?? []) as MemberRow[];
  const invitations = (invitationsRes.data ?? []) as InvitationRow[];
  const myRole = (selfMembershipRes.data?.role ?? "viewer") as BrandRole;

  const t = await getTranslations("brandDetail");

  return (
    <div className="space-y-6">
      <Link
        href="/brands"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl-flip" />
        {t("backToAll")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <GuidedTour />
      </div>

      <BrandStudio
        brandId={brand.id}
        brandName={brand.name}
        existingAudience={kit?.audience ?? null}
        initialStrategy={strategy}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-accent" />
            Identité de marque
          </CardTitle>
          <CardDescription>
            Ton logo, tes couleurs, ton ton. L&apos;audience et la voix
            personnalisent aussi ce que l&apos;IA génère pour cette marque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandKitManager brandId={brand.id} kit={kit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-accent" />
            {t("team.title")}
          </CardTitle>
          <CardDescription>{t("team.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamSection
            brandId={brand.id}
            currentUserId={user.id}
            currentUserRole={myRole}
            members={members}
            invitations={invitations}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4 text-accent" />
            Thèmes de contenu
          </CardTitle>
          <CardDescription>
            Les sujets récurrents de ta marque — ce dont tu parles dans tes
            vidéos. Laisse l&apos;IA te les proposer, ou ajoute-les à la main.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div data-tour="create-themes" className="inline-block">
            <ThemeAssistant brandId={brand.id} />
          </div>
          <div data-tour="themes-list">
            <PillarManager brandId={brand.id} pillars={pillars} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="size-4 text-accent" />
            Setups de tournage
          </CardTitle>
          <CardDescription>
            Tes lieux et cadrages récurrents (ex : les 4 coins de ton bureau).
            Définis-les une fois ici, insère-les en 1 clic dans le storyboard
            d&apos;une vidéo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScenePresetManager brandId={brand.id} presets={scenePresets} />
        </CardContent>
      </Card>
    </div>
  );
}
