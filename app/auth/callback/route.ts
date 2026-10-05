import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Le retour des e-mails envoyés par Supabase : confirmation d'inscription,
 * lien d'invitation, réinitialisation de mot de passe.
 *
 * Cette route n'existait pas. Un compte créé recevait bien son e-mail, mais
 * le lien atterrissait sur une page qui ne faisait RIEN du code : la session
 * n'était jamais ouverte, et personne ne pouvait finir son inscription.
 *
 * Deux formats de lien circulent selon le gabarit d'e-mail configuré côté
 * Supabase — `?code=` (PKCE) et `?token_hash=&type=` (OTP). On accepte les
 * deux : le gabarit peut changer dans le tableau de bord sans prévenir le
 * code.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Derrière Vercel, `request.url` porte parfois l'hôte interne : on
  // reconstruit l'adresse publique à partir des en-têtes du proxy, et on
  // préfère NEXT_PUBLIC_SITE_URL quand elle est renseignée.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin);

  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/login?error=${encodeURIComponent(reason)}`);

  // Supabase renvoie parfois l'erreur directement dans l'adresse (lien
  // expiré, déjà utilisé). Autant la montrer que rediriger dans le vide.
  const described = url.searchParams.get("error_description");
  if (described) return fail(described);

  // Où aller une fois connecté. Uniquement un chemin interne : une adresse
  // complète fournie par le lien permettrait d'envoyer l'utilisateur
  // ailleurs avec sa session fraîchement ouverte.
  const requested = url.searchParams.get("next") ?? "";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/dashboard";

  const supabase = await createClient();

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return NextResponse.redirect(`${base}${next}`);
  }

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "invite" | "recovery" | "email_change" | "magiclink",
      token_hash: tokenHash,
    });
    if (error) return fail(error.message);
    // Une réinitialisation ouvre bien une session, mais la suite logique est
    // de choisir un nouveau mot de passe, pas d'atterrir sur le tableau de bord.
    return NextResponse.redirect(
      `${base}${type === "recovery" ? "/reset-password" : next}`,
    );
  }

  return fail("Lien de confirmation incomplet ou expiré.");
}
