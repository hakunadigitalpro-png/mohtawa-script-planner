"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/(app)/actions";

const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية (Arabe)" },
];

export function ProfileForm({
  email,
  fullName,
  language,
}: {
  email: string;
  fullName: string;
  language: string;
}) {
  const [lang, setLang] = useState(language);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const res = await updateProfile(fd);
          if (res?.error) setMsg({ type: "error", text: res.error });
          else setMsg({ type: "ok", text: "Modifications enregistrées." });
        })
      }
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="full_name">Nom complet</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Adresse email</Label>
        <Input id="email" type="email" defaultValue={email} disabled />
        <p className="text-xs text-muted">L&apos;email n&apos;est pas modifiable.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">Langue préférée</Label>
        <Select
          id="language"
          name="language"
          value={lang}
          onValueChange={setLang}
          options={LANGUAGE_OPTIONS}
        />
        <p className="text-xs text-muted">
          La version arabe arrive bientôt.
        </p>
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
        {pending ? "Enregistrement..." : "Enregistrer les modifications"}
      </Button>
    </form>
  );
}
