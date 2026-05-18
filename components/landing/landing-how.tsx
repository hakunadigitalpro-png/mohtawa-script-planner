"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Section "Comment ça marche" — inspirée de "Simple Solutions!" de BrandBuzz.
 * Background crème/orange clair pour casser le rythme du gradient warm.
 */
export function LandingHow() {
  const t = useTranslations("landing.how");

  const steps = ["step1", "step2", "step3", "step4"] as const;

  return (
    <section
      id="how"
      className="scroll-mt-20 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2.5rem] bg-orange-soft/70 px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            {/* Left: schematic illustration (CSS only) */}
            <div className="order-2 lg:order-1">
              <PipelineIllustration />
            </div>

            {/* Right: copy + steps */}
            <div className="order-1 lg:order-2">
              <span className="inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
                {t("eyebrow")}
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {t("title")}
              </h2>
              <p className="mt-3 text-base text-foreground/80">
                {t("subtitle")}
              </p>

              <ol className="mt-8 space-y-5">
                {steps.map((s, i) => (
                  <li key={s} className="flex gap-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">
                        {t(`${s}.title`)}
                      </h3>
                      <p className="mt-0.5 text-sm text-foreground/75">
                        {t(`${s}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-8">
                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({ variant: "accent", size: "lg" }),
                    "group",
                  )}
                >
                  {t("cta")}
                  <ArrowRight className="size-4 rtl-flip transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Petite illustration "pipeline" CSS only : 4 nodes connectés.
 * Évoque le flux Plan → Script → Storyboard → Mesure sans dépendre d'un asset.
 */
function PipelineIllustration() {
  const nodes = [
    { label: "Plan", color: "bg-amber-400" },
    { label: "Script", color: "bg-emerald-400" },
    { label: "Board", color: "bg-lavender" },
    { label: "Stats", color: "bg-orange" },
  ];
  return (
    <div className="relative mx-auto max-w-md rounded-3xl border border-border/40 bg-card/80 p-6 backdrop-blur-sm">
      <div className="flex flex-col gap-4">
        {nodes.map((n, i) => (
          <div
            key={n.label}
            className="relative flex items-center gap-4 rounded-2xl border border-border/40 bg-card p-3 shadow-sm"
            style={{ marginInlineStart: `${i * 12}px` }}
          >
            <div
              className={`size-10 rounded-xl ${n.color} flex items-center justify-center text-sm font-bold text-white`}
            >
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="h-2.5 w-20 rounded bg-foreground/70" />
              <div className="mt-1.5 h-2 w-32 rounded bg-foreground/15" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
