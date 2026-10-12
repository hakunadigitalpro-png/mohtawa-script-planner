import { NextResponse } from "next/server";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { setActiveBrandId } from "@/lib/brand";
import { safeNext } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La porte unique pour changer de marque EN SUIVANT UN LIEN.
 *
 * La marque active vit dans un cookie, et un Server Component ne peut pas
 * l'écrire pendant son rendu. Quand un e-mail, une notification ou une tâche
 * ouvre un contenu d'une autre marque, la fiche renvoie ici : on vérifie que
 * la marque est bien à la personne, on pose le cookie, on repart vers le
 * contenu. Le menu latéral, le rôle, Krea et le calendrier sont alors ceux
 * de la bonne marque — comme la cloche le faisait déjà avant d'ouvrir.
 *
 * Un `GET` qui pose ce cookie n'ouvre aucun droit : la RLS ne regarde que
 * `brand_members`, jamais le cookie. Le choix explicite d'une marque dans le
 * sélecteur, lui, reste une action (`switchBrand`).
 *
 * Ouvert au client invité (`viewer`) : c'est ce qui lui permet d'arriver sur
 * sa page de validation d'une autre marque.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? "";
  const next = safeNext(url.searchParams.get("next"));

  // Derrière Vercel, `request.url` porte parfois l'hôte interne : même
  // reconstruction que `app/auth/callback/route.ts`.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin);

  const user = await getCachedUser();
  if (!user) {
    const login = new URL("/login", base);
    login.searchParams.set("next", `${url.pathname}${url.search}`);
    return NextResponse.redirect(login);
  }

  if (!UUID_RE.test(to)) return NextResponse.redirect(new URL("/dashboard", base));

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("brand_members")
    .select("brand_id")
    .eq("brand_id", to)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.redirect(new URL("/dashboard", base));

  await setActiveBrandId(to);
  return NextResponse.redirect(new URL(next, base));
}
