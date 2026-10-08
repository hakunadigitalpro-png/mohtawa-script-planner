// Les Server Actions IA de cette page (Studio de marque, assistant de
// thèmes) dépassent facilement les 10s par défaut du plan Hobby Vercel —
// même fix que content/[id]/page.tsx. On monte à 60s (max autorisé).
export const maxDuration = 60;

import { notFound, redirect } from "next/navigation";
import { Clapperboard, Layers, Palette, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PillarManager } from "./pillar-manager";
import { ThemeAssistant } from "./theme-assistant";
import { BrandAiSwitch } from "./ai-switch";
import { ScenePresetManager } from "./scene-preset-manager";
import { BrandKitManager } from "./brand-kit-manager";
import { BrandStudio } from "./brand-studio";
import { TeamSection } from "./team-section";
import { PageHeader } from "@/components/page-header";
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

  const user = await getCachedUser();
  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, ai_enabled")
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
  // Un "viewer" (client invité) est cantonné au Calendrier.
  if (myRole === "viewer") redirect("/calendar");

  const t = await getTranslations("brandDetail");

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/brands"
        backLabel={t("backToAll")}
        title={brand.name}
        subtitle={t("subtitle")}
      />

      {/* Dans l'ordre du travail — et c'est l'ordre de la visite guidée :
          la stratégie déverrouille tout (thèmes, voix de Krea), puis les
          thèmes, les lieux de tournage, le logo, l'équipe. L'interrupteur
          d'écriture assistée est l'exception, donc en dernier. */}
      <div data-tour="brand-strategy">
        <BrandStudio brandId={brand.id} initialStrategy={strategy} />
      </div>

      <Card data-tour="brand-themes">
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
          <ThemeAssistant brandId={brand.id} strategy={strategy} />
          <PillarManager brandId={brand.id} pillars={pillars} />
        </CardContent>
      </Card>

      <Card data-tour="brand-setups">
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

      <Card data-tour="brand-identity">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-accent" />
            Identité de marque
          </CardTitle>
          <CardDescription>
            Le logo de ta marque, utilisé partout dans l&apos;app.
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

      <div data-tour="brand-ai">
      <BrandAiSwitch
        brandId={brand.id}
        initialEnabled={(brand as { ai_enabled?: boolean }).ai_enabled !== false}
      />
      </div>






    </div>
  );
}
