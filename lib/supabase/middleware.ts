import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/utils";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/reset-password");
  const isPublic =
    path === "/" ||
    // Fichiers PWA : doivent être lisibles SANS être connecté (sinon
    // l'install / PWABuilder tombe sur la page de login au lieu du JSON).
    path === "/manifest.webmanifest" ||
    path === "/sw.js" ||
    isAuthRoute ||
    path.startsWith("/auth/") ||
    path.startsWith("/share/") ||
    path.startsWith("/invite/");

  if (!user && !isPublic) {
    // Le lien survit à la connexion : un client qui ouvre « Voir et valider »
    // sur son téléphone doit arriver sur le contenu, pas sur le calendrier.
    // La recherche d'origine est REMPLACÉE, pas clonée : `/review?c=X`
    // arrivait sur `/login?c=X`, que personne ne lisait.
    const login = url.clone();
    login.pathname = "/login";
    login.search = "";
    if (path !== "/") login.searchParams.set("next", `${path}${url.search}`);
    return NextResponse.redirect(login);
  }

  if (user && isAuthRoute) {
    // Déjà connecté : même règle dans l'autre sens, on honore `next`.
    const target = url.clone();
    const next = safeNext(url.searchParams.get("next"));
    const [nextPath, nextSearch = ""] = next.split("?");
    target.pathname = nextPath;
    target.search = nextSearch ? `?${nextSearch}` : "";
    return NextResponse.redirect(target);
  }

  return response;
}
