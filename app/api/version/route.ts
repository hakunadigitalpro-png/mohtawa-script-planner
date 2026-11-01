import { NextResponse } from "next/server";
import { getBuildId } from "@/lib/build-id";

/** Version du serveur, interrogée par le bandeau « Mettre à jour ».
 *  Jamais mise en cache : c'est tout l'intérêt. */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { id: getBuildId() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
