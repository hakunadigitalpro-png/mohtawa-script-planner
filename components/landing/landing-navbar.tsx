"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { LandingLocaleSwitcher } from "./landing-locale-switcher";

/**
 * Navbar sticky de la landing.
 *  - Transparente en haut, blur + bordure subtile au scroll
 *  - Menu burger sur mobile (drawer simple)
 *  - LocaleSwitcher + CTAs droite (en RTL : à gauche automatiquement via flex-row)
 */
export function LandingNavbar() {
  const t = useTranslations("landing.nav");
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Ferme le drawer si on resize au-dessus du breakpoint mobile
  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const navLinks = [
    { href: "#features", label: t("features") },
    { href: "#how", label: t("how") },
    { href: "#personas", label: t("personas") },
    { href: "#faq", label: t("faq") },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-200",
        scrolled
          ? "border-b border-border/40 bg-background/85 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="transition hover:opacity-90">
          <Logo wordmarkClassName="text-lg" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/75 transition hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right side: locale + CTAs */}
        <div className="flex items-center gap-2">
          <LandingLocaleSwitcher />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden sm:inline-flex",
            )}
          >
            {t("signin")}
          </Link>
          <Link
            href="/register"
            className={buttonVariants({ variant: "accent", size: "sm" })}
          >
            {t("signup")}
          </Link>

          {/* Mobile burger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-full text-foreground/80 hover:bg-secondary md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-border/40 bg-background/95 backdrop-blur-md md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground/85 hover:bg-secondary"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground/85 hover:bg-secondary sm:hidden"
            >
              {t("signin")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
