import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

/**
 * Section « Combien ça coûte ». Hard-codée volontairement : la landing a
 * besoin de son propre vocabulaire (« la plus choisie », l'IA en option,
 * les bénéfices phrasés en avantages). Si la grille bouge, on la bouge
 * ici — la source de vérité des limites reste `plans` côté base.
 */
type Plan = {
  id: "solo" | "agence" | "studio";
  label: string;
  tagline: string;
  priceTnd: number;
  priceEur: number;
  features: string[];
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "solo",
    label: "Solo",
    tagline: "Pour commencer, seul·e, avec une seule marque.",
    priceTnd: 29,
    priceEur: 9,
    features: [
      "1 marque",
      "1 utilisateur",
      "1 client invité",
      "Calendrier, planning, publicités",
      "Validation client en lien magique",
    ],
  },
  {
    id: "agence",
    label: "Agence",
    tagline: "Toi, ton équipe, tes clients. Le plan qu'on choisit le plus.",
    priceTnd: 99,
    priceEur: 29,
    features: [
      "Jusqu'à 10 marques",
      "5 membres par marque",
      "10 clients invités par marque",
      "Validation, remarques et notifications e-mail",
      "Campagnes publicitaires (Meta, Google…)",
    ],
    highlighted: true,
  },
  {
    id: "studio",
    label: "Studio",
    tagline: "Pour les agences qui gèrent beaucoup de marques.",
    priceTnd: 249,
    priceEur: 79,
    features: [
      "Marques illimitées",
      "Membres et clients illimités",
      "IA incluse",
      "Support prioritaire",
      "Dédicaces d'onboarding",
    ],
  },
];

export function LandingPricing() {
  return (
    <section id="tarifs" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
            Tarifs
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
            Un plan pour chaque étape.
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Tu commences gratuitement 14 jours. Pas de carte à l&apos;inscription,
            pas de reconduction automatique — c&apos;est toi qui décides quand
            payer.
          </p>
        </div>

        {/* Cartes */}
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        {/* Note IA */}
        <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-bold text-foreground">L&apos;IA en option</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                L&apos;IA (génération de scripts, de stratégie, de légendes)
                est tarifée séparément : <strong>+29 TND/mois</strong> ou{" "}
                <strong>+9 €/mois</strong> par marque active. Incluse d&apos;office
                dans le plan Studio.
              </p>
            </div>
          </div>
        </div>

        {/* Note bêta */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          En bêta, les 14 premiers jours sont offerts sur le plan Agence.
          Au-delà, contacte-nous pour prolonger ou passer sur un plan payant.
        </p>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-6 ${
        plan.highlighted
          ? "border-accent bg-accent/5 shadow-lg shadow-accent/10"
          : "border-border/60 bg-card"
      }`}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          La plus choisie
        </span>
      )}
      <h3 className="text-xl font-bold text-foreground">{plan.label}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold text-foreground">
          {plan.priceTnd}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          TND / mois
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        ou {plan.priceEur} €/mois
      </p>
      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2.5 text-sm text-foreground"
          >
            <Check
              className={`mt-0.5 size-4 shrink-0 ${
                plan.highlighted ? "text-accent" : "text-muted-foreground"
              }`}
              aria-hidden
            />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/register"
        className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${
          plan.highlighted
            ? "bg-accent text-white hover:bg-accent/90"
            : "border border-border bg-card text-foreground hover:bg-secondary"
        }`}
      >
        Commencer avec {plan.label}
      </Link>
    </div>
  );
}
