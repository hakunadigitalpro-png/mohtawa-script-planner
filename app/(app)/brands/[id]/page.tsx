import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Layers, Target, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TaxonomyManager } from "./taxonomy-manager";
import { TeamSection } from "./team-section";
import type { BrandRole } from "../team-actions";

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
      .select("id, name")
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

  const pillars = (pillarsRes.data ?? []) as Taxonomy[];
  const objectives = (objectivesRes.data ?? []) as Taxonomy[];
  const members = (membersRes.data ?? []) as MemberRow[];
  const invitations = (invitationsRes.data ?? []) as InvitationRow[];
  const myRole = (selfMembershipRes.data?.role ?? "viewer") as BrandRole;

  return (
    <div className="space-y-6">
      <Link
        href="/brands"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Toutes les marques
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
        <p className="text-sm text-muted">
          Configure les piliers et objectifs, et gère ton équipe pour cette marque.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-accent" />
            Équipe
          </CardTitle>
          <CardDescription>
            Les personnes qui peuvent voir et modifier les vidéos de cette marque.
          </CardDescription>
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
            Piliers de contenu
          </CardTitle>
          <CardDescription>
            Les thématiques récurrentes de la marque. Tu les retrouveras dans le menu
            « Pilier » lors de la création d&apos;une vidéo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxonomyManager
            kind="pillar"
            brandId={brand.id}
            items={pillars}
            emptyLabel="Aucun pilier pour le moment. Ex : Marketing digital, Productivité, Personal branding..."
            inputPlaceholder="Ex : Marketing digital"
            addLabel="Ajouter un pilier"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-accent" />
            Objectifs
          </CardTitle>
          <CardDescription>
            Les objectifs business possibles pour les vidéos. Ajoute ceux qui
            correspondent à cette marque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxonomyManager
            kind="objective"
            brandId={brand.id}
            items={objectives}
            emptyLabel="Aucun objectif. Ex : Éducation, Vente, Notoriété..."
            inputPlaceholder="Ex : Lead generation"
            addLabel="Ajouter un objectif"
          />
        </CardContent>
      </Card>
    </div>
  );
}
