import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";

/**
 * VERSION DIAGNOSTIC — isole le crash. Pas de composants, pas de JSX
 * complexe. On loge chaque étape pour que, si une étape plante, la stack
 * atteigne au moins les logs Vercel. On rend ensuite les données en texte
 * brut dans un <pre> : si on y arrive, le problème était dans les
 * composants Liste/Planning/Calendrier et pas dans le chargement.
 */
export default async function AdsPage(props: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const trace: string[] = [];
  try {
    trace.push("1. start");
    const supabase = await createClient();
    trace.push("2. supabase ok");

    const user = await getCachedUser();
    trace.push(`3. user ok (${user ? "logged" : "anon"})`);
    if (!user) redirect("/login");

    trace.push("4. resolve brand");
    const { active, role } = await resolveActiveBrand();
    trace.push(`5. brand ok (${active?.name ?? "none"} / role=${role ?? "none"})`);
    if (role === "viewer") redirect("/calendar");
    if (!active) redirect("/dashboard");

    trace.push("6. query campaigns");
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select(
        "id, title, status, review_state, platforms, date_start, date_end",
      )
      .eq("brand_id", active.id);
    if (error) throw new Error(`campaigns query: ${error.message}`);
    trace.push(`7. got ${data?.length ?? 0} campaigns`);

    trace.push("8. render");
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="mb-3 text-base font-semibold text-emerald-900">
          /ads diagnostic — toutes les étapes serveur sont passées
        </h2>
        <p className="mb-2 text-sm text-emerald-900">
          Marque active : {active.name} ({active.id})
        </p>
        <p className="mb-3 text-sm text-emerald-900">
          Campagnes trouvées : {data?.length ?? 0}
        </p>
        <h3 className="mb-1 text-sm font-semibold text-emerald-900">
          Trace
        </h3>
        <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-900">
          {trace.join("\n")}
        </pre>
        <h3 className="mb-1 mt-3 text-sm font-semibold text-emerald-900">
          Données brutes
        </h3>
        <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-900">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND") {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        <h2 className="mb-2 text-base font-semibold">
          /ads a planté (debug)
        </h2>
        <p className="mb-1">
          <strong>Message :</strong> {message}
        </p>
        <h3 className="mb-1 mt-3 text-sm font-semibold">Trace</h3>
        <pre className="whitespace-pre-wrap font-mono text-xs">
          {trace.join("\n")}
        </pre>
        {stack ? (
          <>
            <h3 className="mb-1 mt-3 text-sm font-semibold">Stack</h3>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs">
              {stack}
            </pre>
          </>
        ) : null}
      </div>
    );
  }
}
