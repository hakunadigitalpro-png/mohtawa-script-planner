"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createBrand } from "@/app/(app)/actions";

export function NoBrandWelcome({ email }: { email: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-ink text-white">
            <Sparkles className="size-5" />
          </div>
          <CardTitle>Bienvenue sur Mohtawa</CardTitle>
          <CardDescription>
            Commence par créer ta première marque. Tu pourras en ajouter d&apos;autres
            plus tard (ex : ton compte perso, un client, une boîte).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={(fd) =>
              startTransition(async () => {
                const res = await createBrand(fd);
                if (res?.error) setError(res.error);
              })
            }
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la marque</Label>
              <Input id="name" name="name" required autoFocus placeholder="Ex : Mon compte perso" />
            </div>
            {error && (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Création..." : "Créer ma première marque"}
            </Button>
            {email && (
              <p className="text-center text-xs text-muted">
                Connecté en tant que {email}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
