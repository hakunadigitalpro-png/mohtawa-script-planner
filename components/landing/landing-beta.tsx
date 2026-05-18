"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Section "Beta testers wanted" — remplace les fakes testimonials.
 * Honnête ("on est en bêta") + promesse forte ("gratuit à vie").
 *
 * Visuel inspiré de la bande orange "Ready to get started?" de BrandBuzz.
 */
export function LandingBeta() {
  const t = useTranslations("landing.beta");
  const perks = ["p1", "p2", "p3", "p4"] as const;

  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-accent via-orange-strong to-accent px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
          {/* Décoration : petits dots */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 10% 20%, rgba(255,255,255,0.4) 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.4) 1.5px, transparent 1.5px)",
              backgroundSize: "60px 60px, 80px 80px",
            }}
          />

          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            {/* Left: copy */}
            <div className="text-accent-foreground">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                <Sparkles className="size-3" />
                {t("badge")}
              </div>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {t("title")}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/90 sm:text-lg">
                {t("description")}
              </p>

              <div className="mt-8">
                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-white text-accent hover:bg-white/90 group",
                  )}
                >
                  {t("cta")}
                  <ArrowRight className="size-4 rtl-flip transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Right: perks list */}
            <ul className="space-y-3 text-accent-foreground">
              {perks.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-accent">
                    <Check className="size-3" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium leading-snug">
                    {t(`perks.${p}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
