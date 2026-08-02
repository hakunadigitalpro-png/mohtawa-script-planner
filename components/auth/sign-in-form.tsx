"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Mail, Lock } from "lucide-react";
import { AuthField } from "./auth-field";
import { login } from "@/app/(auth)/login/actions";

/** Formulaire de connexion (moitié droite/gauche de la carte Diprella). */
export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations("auth.login");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const res = await login(fd);
          if (res?.error === "missing") setError(t("errorMissing"));
          else if (res?.error === "invalid") setError(t("errorInvalid"));
        })
      }
      className="flex w-full max-w-xs flex-col items-center gap-3.5"
    >
      <h1 className="text-2xl font-bold text-accent">{t("title")}</h1>
      <p className="-mt-1 mb-1 text-center text-xs text-muted">{t("subtitle")}</p>

      {next && <input type="hidden" name="next" value={next} />}

      <AuthField
        icon={Mail}
        name="email"
        type="email"
        placeholder={t("email")}
        autoComplete="email"
        required
      />
      <AuthField
        icon={Lock}
        name="password"
        type="password"
        placeholder={t("password")}
        autoComplete="current-password"
        required
      />

      <Link
        href="/reset-password"
        className="text-xs text-muted transition hover:text-accent"
      >
        {t("forgotPassword")}
      </Link>

      {error && (
        <p className="w-full rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-full bg-accent px-10 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? t("submitLoading") : t("submit")}
      </button>
    </form>
  );
}
