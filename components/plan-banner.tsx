import Link from "next/link";
import { getMyPlan, daysRemaining } from "@/lib/plans";

/**
 * Bandeau rouge/orange affiché en haut de l'app quand l'accès va se
 * couper (7 jours) ou s'est déjà coupé. Server Component — pas de
 * clignotement.
 */
export async function PlanBanner() {
  const plan = await getMyPlan();
  if (!plan) return null;

  if (plan.status === "readonly") {
    return (
      <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center text-sm text-rose-900 dark:text-rose-200">
        Ton accès est en lecture seule. <ContactLink />
      </div>
    );
  }

  if (plan.status === "suspended") {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        Ton compte est suspendu. <ContactLink />
      </div>
    );
  }

  const days = daysRemaining(plan);
  if (days !== null && days >= 0 && days <= 7) {
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-200">
        Il te reste <strong>{days === 0 ? "moins d'un jour" : `${days} jour${days > 1 ? "s" : ""}`}</strong>{" "}
        sur ton accès. <ContactLink />
      </div>
    );
  }

  return null;
}

function ContactLink() {
  return (
    <Link
      href="https://wa.me/21629555090"
      target="_blank"
      className="font-semibold underline underline-offset-2"
    >
      Contacter Mariam
    </Link>
  );
}
