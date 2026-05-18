"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Section FAQ — accordéon custom (pas de lib).
 * Un seul item ouvert à la fois pour rester lisible.
 */
export function LandingFaq() {
  const t = useTranslations("landing.faq");
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  const items = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"] as const;

  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Eyebrow + title */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
            {t("eyebrow")}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
        </div>

        {/* Items */}
        <div className="mt-12 space-y-3">
          {items.map((q, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={q}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-card transition-colors",
                  isOpen
                    ? "border-accent/40 shadow-sm"
                    : "border-border/60 hover:border-foreground/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-foreground">
                    {t(`items.${q}.question`)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-muted transition-transform",
                      isOpen && "rotate-180 text-accent",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {t(`items.${q}.answer`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
