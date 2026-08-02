"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { User, Mail, Lock } from "lucide-react";
import { AuthField } from "./auth-field";
import { register } from "@/app/(auth)/register/actions";

/** Formulaire d'inscription (moitié de la carte Diprella). */
export function SignUpForm({ next }: { next?: string }) {
  const t = useTranslations("auth.register");
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const res = await register(fd);
          if (res?.error === "passwordTooShort") {
            setMessage({ type: "error", text: t("errorPasswordTooShort") });
          } else if (res?.error) {
            setMessage({ type: "error", text: res.error });
          } else if (res?.success === "confirmEmail") {
            setMessage({ type: "success", text: t("successConfirmEmail") });
          }
        })
      }
      className="flex w-full max-w-xs flex-col items-center gap-3.5"
    >
      <h1 className="text-2xl font-bold text-accent">{t("title")}</h1>
      <p className="-mt-1 mb-1 text-center text-xs text-muted">{t("subtitle")}</p>

      {next && <input type="hidden" name="next" value={next} />}

      <AuthField
        icon={User}
        name="full_name"
        type="text"
        placeholder={t("fullName")}
        autoComplete="name"
        required
      />
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
        autoComplete="new-password"
        minLength={6}
        required
      />

      {message && (
        <p
          className={
            "w-full rounded-lg px-3 py-2 text-center text-xs font-medium " +
            (message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-50 text-emerald-700")
          }
        >
          {message.text}
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
