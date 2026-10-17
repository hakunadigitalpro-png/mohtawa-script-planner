import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";

/**
 * Création d'une campagne via GET sur /ads/new → insert puis redirect
 * vers la fiche. Alternative au `<form action={serverAction}>` qui plantait
 * sous Next 16 avec le PageHeader (cause en cours d'identification).
 */
export async function GET() {
  const supabase = await createClient();
  const { active } = await resolveActiveBrand();
  if (!active) return NextResponse.redirect(new URL("/dashboard", "https://mohtawa-script-planner.vercel.app"));

  const { data, error } = await supabase
    .from("ad_campaigns")
    .insert({ brand_id: active.id, title: "Nouvelle campagne" })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Création impossible" }, { status: 500 });
  }
  return NextResponse.redirect(new URL(`/ads/${data.id}`, "https://mohtawa-script-planner.vercel.app"));
}
