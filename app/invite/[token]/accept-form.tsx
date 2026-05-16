"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptBrandInvitation } from "@/app/(app)/brands/team-actions";

export function AcceptInviteForm({
  token,
  brandId,
}: {
  token: string;
  brandId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onAccept = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptBrandInvitation(token);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      // On set le cookie active_brand côté client puis on push
      document.cookie = `active_brand=${brandId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Button onClick={onAccept} disabled={pending} className="w-full">
        {pending ? (
          "Acceptation…"
        ) : (
          <>
            <Check className="size-4" />
            Accepter l&apos;invitation
          </>
        )}
      </Button>
      {error && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
