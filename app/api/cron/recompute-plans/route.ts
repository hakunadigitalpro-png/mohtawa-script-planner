import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Tâche planifiée (Coolify Scheduled Tasks ou cron externe) qui met à
 * jour le statut stocké des abonnements expirés.
 *
 * Depuis la migration 0069, `get_my_plan()` calcule déjà `readonly` à la
 * volée côté utilisateur, donc la coupe d'accès est immédiate — cette
 * route n'est là que pour que `/admin` affiche le vrai statut sans avoir
 * à recalculer, et pour servir de point d'ancrage à de futurs envois
 * (relance 24 h avant expiration, bascule 'readonly → suspended' après
 * 30 jours, etc.).
 *
 * Protection : header `Authorization: Bearer <CRON_SECRET>` requis en
 * production.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("recompute_subscription_statuses");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: data ?? 0 });
}
