import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé SERVICE ROLE : passe au-dessus de la RLS et
 * donne accès à l'API d'administration des comptes (auth.admin.*).
 *
 * À n'utiliser QUE depuis des Server Actions déjà gardées par
 * `is_platform_admin()` — jamais dans un composant, jamais exposé au
 * navigateur. Sans la clé dans Coolify, on lève une erreur lisible plutôt
 * qu'un 500 muet : c'est la seule variable que l'écran Admin exige en plus.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manque dans Coolify (app Kreatly → Environment Variables). " +
        "Copie la valeur de SERVICE_SUPABASESERVICE_KEY du service Supabase, puis redéploie.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Mot de passe initial : 14 caractères sans ambiguïté (pas de 0/O, 1/l/I),
 * lisible à l'oral et au téléphone — c'est Mariam qui le remettra au client.
 */
export function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 9)}-${out.slice(9)}`;
}
