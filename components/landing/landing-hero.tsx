"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LandingMockup } from "./landing-mockup";

/**
 * Hero principal de la landing.
 *  - Titre en 2 lignes avec mot-clé en accent
 *  - 2 CTAs (primary + secondary)
 *  - Mockup interactif à droite (sous le titre sur mobile)
 *  - Petite ligne de "trust" sous les CTAs (pas de carte, FR/AR, RTL natif)
 */
export function LandingHero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="relative overflow-hidden pt-12 sm:pt-16 lg:pt-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
        {/* Left: copy */}
        <div className="text-center lg:text-start">
          {/* Beta badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="size-3" />
            {t("betaBadge")}
          </div>

          {/* Title */}
          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t("title1")}{" "}
            <span className="text-accent">{t("titleAccent")}</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
            {t("subtitle")}
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "accent", size: "lg" }),
                "group",
              )}
            >
              {t("ctaPrimary")}
              <ArrowRight className="size-4 rtl-flip transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("ctaSecondary")}
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-4 text-xs text-muted">{t("trust")}</p>
        </div>

        {/* Right: mockup */}
        <div className="relative">
          <LandingMockup />
        </div>
      </div>
    </section>
  );
}
