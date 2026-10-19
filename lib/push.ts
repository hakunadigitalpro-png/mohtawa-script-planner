import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

/**
 * Expéditeur Web Push côté serveur.
 *
 * - Les CLÉS VAPID sont les mêmes pour toute l'app : la publique est
 *   lue dans le navigateur pour s'abonner, la privée reste côté serveur
 *   pour signer les envois. Sans elles, Chrome et iOS refusent.
 * - L'envoi utilise la service role Supabase : lire TOUS les abonnements
 *   d'un user ignore la RLS, c'est voulu — un cron ne s'authentifie pas
 *   comme un utilisateur. Jamais exposé au client.
 * - Un abonnement périmé (410 Gone, 404 Not Found) est effacé en silence.
 *   Un téléphone qui a désinstallé l'app ou coupé les notifs ne doit pas
 *   faire planter la boucle.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const CONTACT = process.env.VAPID_CONTACT ?? "mailto:hakuna.digitalpro@gmail.com";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type PushPayload = {
  title: string;
  body: string;
  /** Chemin interne à ouvrir au clic : /calendar, /content/[id], etc. */
  url?: string;
  tag?: string;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  const admin = adminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  const subs = (data ?? []) as SubRow[];
  const body = JSON.stringify(payload);

  let sent = 0;
  const toRemove: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        // 410 Gone / 404 Not Found : l'abonnement est mort, on nettoie.
        // Les autres erreurs (réseau, 5xx) on laisse tranquille — un
        // téléphone éteint reviendra la prochaine fois.
        if (code === 410 || code === 404) toRemove.push(s.id);
      }
    }),
  );

  if (toRemove.length) {
    await admin.from("push_subscriptions").delete().in("id", toRemove);
  }

  // Trace de dernier envoi réussi — utile pour nettoyer plus tard les
  // abonnements silencieusement morts qui ne renvoient pas 410.
  if (sent) {
    await admin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  return { sent, removed: toRemove.length };
}
