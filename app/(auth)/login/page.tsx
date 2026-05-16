"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login } from "./actions";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            startTransition(async () => {
              const res = await login(fd);
              if (res?.error === "missing") setError(t("errorMissing"));
              else if (res?.error === "invalid") setError(t("errorInvalid"));
            })
          }
          className="space-y-4"
        >
          {next && <input type="hidden" name="next" value={next} />}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" placeholder={t("emailPlaceholder")} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" placeholder={t("passwordPlaceholder")} required />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? t("submitLoading") : t("submit")}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link href="/reset-password" className="text-muted hover:text-foreground">
              {t("forgotPassword")}
            </Link>
            <Link href={registerHref} className="font-medium hover:underline">
              {t("createAccount")}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
