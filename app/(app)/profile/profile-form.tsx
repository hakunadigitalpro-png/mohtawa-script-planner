"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/(app)/actions";

/**
 * The language selector lives in its own card (LocaleSwitcherFull) since
 * it controls the UI locale via a dedicated server action. This form only
 * handles the user's full name.
 */
export function ProfileForm({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const t = useTranslations("profile");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const res = await updateProfile(fd);
          if (res?.error) setMsg({ type: "error", text: res.error });
          else setMsg({ type: "ok", text: t("saved") });
        })
      }
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="full_name">{t("fullName")}</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" type="email" defaultValue={email} disabled />
        <p className="text-xs text-muted">{t("emailHint")}</p>
      </div>

      {msg && (
        <p
          className={
            "rounded-md px-3 py-2 text-sm " +
            (msg.type === "error"
              ? "border border-destructive/30 bg-destructive/10 text-destructive"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800")
          }
        >
          {msg.text}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
