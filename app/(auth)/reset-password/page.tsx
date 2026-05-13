"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resetPassword } from "./actions";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réinitialiser le mot de passe</CardTitle>
        <CardDescription>Indique ton email, on t&apos;envoie un lien.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            startTransition(async () => {
              const res = await resetPassword(fd);
              if (res?.error) setMessage({ type: "error", text: res.error });
              else if (res?.success) setMessage({ type: "success", text: res.success });
            })
          }
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
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
            {pending ? "Envoi..." : "Envoyer le lien"}
          </Button>

          <p className="text-center text-sm text-muted">
            <Link href="/login" className="hover:text-foreground">
              Retour à la connexion
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
