import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";

/**
 * Création d'une campagne via POST sur /ads/new → insert puis redirect
 * vers la fiche.
 *
 * POST exclusivement : Next.js préchargeait /ads/new quand on affichait
 * un `<Link>` vers cette URL, ce qui créait une campagne brouillon à
 * chaque chargement de /ads. Le POST ne se préchargeait pas, et le GET
 * est désormais interdit pour qu'un bookmark ou un partage de lien n'en
 * crée pas une non plus.
 */
export async function POST() {
  const supabase = await createClient();
  const { active } = await resolveActiveBrand();
  if (!active) {
    return NextResponse.redirect(
      new URL("/dashboard", "https://mohtawa-script-planner.vercel.app"),
      { status: 303 },
    );
  }

  const { data, error } = await supabase
    .from("ad_campaigns")
    .insert({ brand_id: active.id, title: "Nouvelle campagne" })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Création impossible" },
      { status: 500 },
    );
  }
  // 303 : après un POST, on redirige en GET sur la fiche créée.
  return NextResponse.redirect(
    new URL(`/ads/${data.id}`, "https://mohtawa-script-planner.vercel.app"),
    { status: 303 },
  );
}

// Un ancien lien qui ferait un GET explicite ne doit pas créer silencieusement.
export function GET() {
  return NextResponse.redirect(
    new URL("/ads", "https://mohtawa-script-planner.vercel.app"),
    { status: 303 },
  );
}
