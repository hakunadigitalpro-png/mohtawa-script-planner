"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resetPassword } from "./actions";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.reset");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="w-full max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            startTransition(async () => {
              const res = await resetPassword(fd);
              if (res?.error === "emailRequired") {
                setMessage({ type: "error", text: t("errorEmailRequired") });
              } else if (res?.error) {
                setMessage({ type: "error", text: res.error });
              } else if (res?.success === "sent") {
                setMessage({ type: "success", text: t("success") });
              }
            })
          }
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required autoFocus />
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
            <Link href="/login" className="hover:text-foreground">
              {t("backToLogin")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
    </div>
  );
}
