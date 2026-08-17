import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component context - middleware refreshes the session.
          }
        },
      },
    },
  );
}

/**
 * `supabase.auth.getUser()` mémoïsé par requête (React cache) : le layout
 * ET chaque page appellent tous les deux "qui est connecté ?" — sans ça,
 * chaque navigation revérifiait l'identité plusieurs fois (aller-retour
 * réseau vers Supabase Auth à chaque appel). Un seul appel réel par
 * navigation, peu importe combien de composants serveur le demandent.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
