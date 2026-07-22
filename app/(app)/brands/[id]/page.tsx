import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Layers, Target, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TaxonomyManager } from "./taxonomy-manager";
import { PillarManager } from "./pillar-manager";
import { TeamSection } from "./team-section";
import type { BrandRole } from "../team-actions";
import type { BrandPillar } from "@/lib/types";

type Taxonomy = { id: string; name: string };

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
    objectivesRes,
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
      .from("brand_objectives")
      .select("id, name")
      .eq("brand_id", id)
      .order("position", { ascending: true }),
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
  const objectives = (objectivesRes.data ?? []) as Taxonomy[];
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

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>

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
            {t("pillars.title")}
          </CardTitle>
          <CardDescription>{t("pillars.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PillarManager brandId={brand.id} pillars={pillars} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-accent" />
            {t("objectives.title")}
          </CardTitle>
          <CardDescription>{t("objectives.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TaxonomyManager
            kind="objective"
            brandId={brand.id}
            items={objectives}
            emptyLabel={t("objectives.empty")}
            inputPlaceholder={t("objectives.placeholder")}
            addLabel={t("objectives.add")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
