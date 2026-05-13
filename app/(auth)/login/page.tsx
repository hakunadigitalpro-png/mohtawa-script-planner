"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Bon retour. On reprend là où tu t&apos;es arrêté.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            startTransition(async () => {
              const res = await login(fd);
              if (res?.error) setError(res.error);
            })
          }
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input id="email" name="email" type="email" placeholder="nom@email.com" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" required />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Connexion..." : "Se connecter"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link href="/reset-password" className="text-muted hover:text-foreground">
              Mot de passe oublié ?
            </Link>
            <Link href="/register" className="font-medium hover:underline">
              Créer un compte
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
