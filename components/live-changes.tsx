"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Area = "contents" | "ads" | "tasks";
type Change = { area: Area; changed_at: string; actor_name: string | null };

/** Quelle zone regarde la page ouverte. Hors de ces pages : pas de bandeau. */
function areaFor(path: string): Area | null {
  if (path.startsWith("/ads")) return "ads";
  if (path.startsWith("/tasks")) return "tasks";
  if (
    path.startsWith("/calendar") ||
    path.startsWith("/content") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/review")
  )
    return "contents";
  return null;
}

const WHAT: Record<Area, string> = {
  contents: "le planning",
  ads: "les publicités",
  tasks: "les tâches",
};

/**
 * Bandeau « Maryem a modifié le planning — Mettre à jour ».
 *
 * Deux personnes sur la même marque : celle qui n'a pas fait la modif
 * travaillait sur une page périmée sans le savoir. La base note la
 * dernière modif de chaque auteur par zone (0091) ; on la relit toutes les
 * 20 s, au retour sur l'onglet et au focus, et on ne garde que celles des
 * AUTRES. Le premier relevé sert de point de départ : seul ce qui arrive
 * après l'ouverture de la page déclenche le bandeau.
 *
 * « Mettre à jour » = `router.refresh()` : les données sont relues sans
 * recharger la page, ce qu'on est en train de taper n'est pas perdu.
 */
export function LiveChanges({ brandId }: { brandId: string }) {
  const pathname = usePathname();
  const area = areaFor(pathname);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [who, setWho] = useState<string | null | undefined>(undefined);
  // Dernière modif vue par zone : ce qui est plus récent est « nouveau ».
  const seen = useRef<Partial<Record<Area, string>> | null>(null);

  useEffect(() => {
    seen.current = null;
    setWho(undefined);
  }, [brandId, area]);

  useEffect(() => {
    if (!area) return;
    const supabase = createClient();
    let stopped = false;

    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const { data, error } = await supabase.rpc("brand_changes_since", { p_brand: brandId });
      if (stopped || error || !data) return;
      const rows = data as Change[];
      if (seen.current === null) {
        seen.current = Object.fromEntries(rows.map((r) => [r.area, r.changed_at]));
        return;
      }
      const row = rows.find((r) => r.area === area);
      const before = seen.current[area];
      if (row && (!before || Date.parse(row.changed_at) > Date.parse(before))) {
        setWho(row.actor_name);
      }
    };

    check();
    const timer = window.setInterval(check, 20_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [brandId, area]);

  if (!area || who === undefined) return null;

  const refresh = () => {
    // On repart de zéro : le prochain relevé redevient le point de départ.
    seen.current = null;
    startTransition(() => router.refresh());
    setWho(undefined);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      // Même emplacement que le bandeau de nouvelle version, un cran au-dessus.
      className="fixed inset-x-4 bottom-36 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground shadow-[0_12px_40px_-12px_rgba(10,6,18,0.35)] md:inset-x-auto md:bottom-24 md:right-6"
    >
      <span>
        <strong className="font-semibold">{who || "Quelqu'un"}</strong> a modifié {WHAT[area]}.
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground transition hover:brightness-110 disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden />
        Mettre à jour
      </button>
    </div>
  );
}
