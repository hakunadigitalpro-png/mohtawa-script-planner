import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TaxonomyManager } from "./taxonomy-manager";

type Taxonomy = { id: string; name: string };

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!brand) notFound();

  const [pillarsRes, objectivesRes] = await Promise.all([
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
  ]);

  const pillars = (pillarsRes.data ?? []) as Taxonomy[];
  const objectives = (objectivesRes.data ?? []) as Taxonomy[];

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
          Configure les piliers et objectifs réutilisables pour cette marque.
        </p>
      </div>

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
