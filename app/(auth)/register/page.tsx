"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { register } from "./actions";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

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
          className="space-y-4"
        >
          {next && <input type="hidden" name="next" value={next} />}
          <div className="space-y-2">
            <Label htmlFor="full_name">{t("fullName")}</Label>
            <Input id="full_name" name="full_name" type="text" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" placeholder="nom@email.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" required minLength={6} />
          </div>

          {message && (
            <p
              className={
                "rounded-md px-3 py-2 text-sm " +
                (message.type === "error"
                  ? "border border-destructive/30 bg-destructive/10 text-destructive"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-800")
              }
            >
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? t("submitLoading") : t("submit")}
          </Button>

          <p className="text-center text-sm text-muted">
            {t("haveAccount")}{" "}
            <Link href={loginHref} className="font-medium text-foreground hover:underline">
              {t("signin")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
