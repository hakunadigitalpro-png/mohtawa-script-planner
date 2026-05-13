"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { register } from "./actions";

export default function RegisterPage() {
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>Ton espace de création est prêt en moins d&apos;une minute.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            startTransition(async () => {
              const res = await register(fd);
              if (res?.error) setMessage({ type: "error", text: res.error });
              else if (res?.success) setMessage({ type: "success", text: res.success });
            })
          }
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="full_name">Nom complet</Label>
            <Input id="full_name" name="full_name" type="text" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input id="email" name="email" type="email" placeholder="nom@email.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
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
            {pending ? "Création..." : "Créer mon espace"}
          </Button>

          <p className="text-center text-sm text-muted">
            Déjà inscrit ?{" "}
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
