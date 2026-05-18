"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles, Instagram, Linkedin, Youtube } from "lucide-react";

/**
 * Footer minimaliste mais complet.
 * 3 colonnes de liens + branding + mentions légales en bas.
 */
export function LandingFooter() {
  const t = useTranslations("landing.footer");

  return (
    <footer className="border-t border-border/40 bg-card/30 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Branding */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-bold text-lg text-foreground"
            >
              <span className="inline-flex size-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Sparkles className="size-4" />
              </span>
              <span>Mohtawa</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>

            {/* Socials */}
            <div className="mt-5 flex items-center gap-2">
              <SocialLink href="https://instagram.com/mohtawa" label="Instagram">
                <Instagram className="size-4" />
              </SocialLink>
              <SocialLink href="https://linkedin.com/company/mohtawa" label="LinkedIn">
                <Linkedin className="size-4" />
              </SocialLink>
              <SocialLink href="https://youtube.com/@mohtawa" label="YouTube">
                <Youtube className="size-4" />
              </SocialLink>
            </div>
          </div>

          {/* Product */}
          <FooterColumn title={t("product")}>
            <FooterLink href="#features">
              {t("productLinks.features")}
            </FooterLink>
            <FooterLink href="#how">{t("productLinks.how")}</FooterLink>
            <FooterLink href="#personas">
              {t("productLinks.personas")}
            </FooterLink>
            <FooterLink href="#faq">{t("productLinks.faq")}</FooterLink>
          </FooterColumn>

          {/* Company */}
          <FooterColumn title={t("company")}>
            <FooterLink href="/register">
              {t("companyLinks.beta")}
            </FooterLink>
            <FooterLink href="mailto:hello@mohtawa.tn">
              {t("companyLinks.contact")}
            </FooterLink>
          </FooterColumn>

          {/* Legal */}
          <FooterColumn title={t("legal")}>
            <FooterLink href="/legal/privacy">
              {t("legalLinks.privacy")}
            </FooterLink>
            <FooterLink href="/legal/terms">
              {t("legalLinks.terms")}
            </FooterLink>
          </FooterColumn>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 text-xs text-muted sm:flex-row">
          <p>
            © {new Date().getFullYear()} Mohtawa. {t("rights")}
          </p>
          <p>{t("made")}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  // Anchor pour les ancres internes, Link Next pour les routes vraies
  const isAnchor = href.startsWith("#") || href.startsWith("mailto:");
  if (isAnchor) {
    return (
      <li>
        <a
          href={href}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground transition hover:text-foreground"
      >
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 bg-card text-muted transition hover:border-accent/40 hover:text-accent"
    >
      {children}
    </a>
  );
}
