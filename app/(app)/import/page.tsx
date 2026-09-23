import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { PageHeader } from "@/components/page-header";
import { PLATFORMS, platformLabel } from "@/lib/constants";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const { active, role } = await resolveActiveBrand();
  // Un "viewer" (client invité) est cantonné au Calendrier.
  if (role === "viewer") redirect("/calendar");
  if (!active) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("brand_pillars")
    .select("name")
    .eq("brand_id", active.id)
    .order("position", { ascending: true });

  const themes = ((data ?? []) as { name: string }[]).map((t) => t.name);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/calendar"
        backLabel="Retour au calendrier"
        eyebrow={active.name}
        title="Importer une série"
        subtitle="Une liste de sujets déjà écrits devient un mois de contenus planifiés."
      />
      <ImportForm
        themes={themes}
        platforms={PLATFORMS.map((p) => ({
          value: p.value,
          label: platformLabel(p.value),
        }))}
      />
    </div>
  );
}
