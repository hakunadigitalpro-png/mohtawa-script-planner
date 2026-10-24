import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Déconnexion. Derrière le reverse proxy Coolify, `request.url` peut
 * refléter l'URL interne du conteneur (`localhost:3000`), ce qui
 * renvoyait l'utilisateur vers une page introuvable après signout. On
 * préfère `NEXT_PUBLIC_SITE_URL` quand elle est posée, et on retombe
 * sur l'origine demandée sinon.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    new URL(request.url).origin;
  return NextResponse.redirect(`${base}/login`, { status: 303 });
}
