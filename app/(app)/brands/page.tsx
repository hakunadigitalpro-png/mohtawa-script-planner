import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandsList } from "./brands-list";
import { CreateBrandButton } from "./create-brand-button";

type BrandWithRole = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  role: string;
  content_count: number;
};

export default async function BrandsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: members } = await supabase
    .from("brand_members")
    .select("brand_id, role, brands(id, name, created_by, created_at)")
    .eq("user_id", user.id);

  const brands: BrandWithRole[] = [];
  for (const m of members ?? []) {
    const b = (m as unknown as { brands: { id: string; name: string; created_by: string; created_at: string } | null }).brands;
    if (!b) continue;
    const { count } = await supabase
      .from("contents")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", b.id);
    brands.push({
      id: b.id,
      name: b.name,
      created_by: b.created_by,
      created_at: b.created_at,
      role: (m as { role: string }).role,
      content_count: count ?? 0,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes marques</h1>
          <p className="text-sm text-muted">
            Gère les espaces de travail rattachés à ton compte.
          </p>
        </div>
        <CreateBrandButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{brands.length} marque{brands.length > 1 ? "s" : ""}</CardTitle>
          <CardDescription>
            Clique sur une marque (ou sur « Gérer ») pour accéder à son équipe, ses piliers de contenu
            et ses objectifs. Tu peux aussi la renommer ou la supprimer ici.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <BrandsList brands={brands} currentUserId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
