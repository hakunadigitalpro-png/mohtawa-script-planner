import { LandingNavbar } from "./landing-navbar";
import { LandingHero } from "./landing-hero";
import { LandingFeatures } from "./landing-features";
import { LandingHow } from "./landing-how";
import { LandingPersonas } from "./landing-personas";
import { LandingWhy } from "./landing-why";
import { LandingBeta } from "./landing-beta";
import { LandingFaq } from "./landing-faq";
import { LandingCtaFinal } from "./landing-cta-final";
import { LandingFooter } from "./landing-footer";

/**
 * Page d'accueil publique de Kreatly.
 *
 * Ordre des sections étudié pour le funnel d'acquisition :
 *  1. Navbar — orientation immédiate + CTA principal
 *  2. Hero — promesse + mockup, accroche le visiteur en <5s
 *  3. Features — "qu'est-ce que je peux faire" (4 cards rapides)
 *  4. How — "comment je l'utilise" (4 étapes)
 *  5. Personas — "est-ce pour moi ?" (3 profils)
 *  6. Why — différenciateurs vs concurrence US
 *  7. Beta — CTA fort avec offre "gratuit à vie"
 *  8. FAQ — lever les objections finales
 *  9. CTA final — dernière chance de conversion
 *  10. Footer
 */
export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
        <LandingHow />
        <LandingPersonas />
        <LandingWhy />
        <LandingBeta />
        <LandingFaq />
        <LandingCtaFinal />
      </main>
      <LandingFooter />
    </div>
  );
}
