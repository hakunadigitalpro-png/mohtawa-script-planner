"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * CTA final avant le footer.
 * Plus discret que la bande "Beta" (qui est déjà une grosse zone orange).
 * Style : carte simple centrée avec 2 CTAs.
 */
export function LandingCtaFinal() {
  const t = useTranslations("landing.finalCta");

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t("description")}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ variant: "accent", size: "lg" }),
              "group",
            )}
          >
            {t("primary")}
            <ArrowRight className="size-4 rtl-flip transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t("secondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
