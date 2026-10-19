"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Bouton d'activation des notifications push.
 *
 * - Vérifie que le navigateur sait les gérer AVANT d'afficher quoi que ce
 *   soit : un onglet Safari non-PWA n'a pas `PushManager` → on dit à
 *   l'utilisatrice d'installer l'app sur l'écran d'accueil, point.
 * - La clé publique VAPID vient d'une env `NEXT_PUBLIC_*`, donc visible
 *   côté navigateur par construction : c'est son rôle.
 * - On stocke rien localement : la source de vérité, c'est l'abonnement
 *   que le navigateur garde et le `push_subscriptions` en base.
 */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<"loading" | "unsupported" | "idle" | "on" | "error">(
    "loading",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (!publicKey) {
        setState("unsupported");
        setMessage("Les notifications ne sont pas encore configurées côté serveur.");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "idle");
      } catch {
        setState("error");
      }
    })();
  }, [publicKey]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Permission refusée dans les réglages du navigateur.");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast via BufferSource : les lib DOM typent `applicationServerKey`
        // avec un ArrayBuffer strict, Uint8Array est accepté à l'exécution.
        applicationServerKey: urlB64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Enregistrement refusé");
      setState("on");
      setMessage("Notifications activées sur cet appareil.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Impossible d'activer les notifications.",
      );
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
      setMessage("Notifications désactivées sur cet appareil.");
    } catch {
      setMessage("Erreur en désactivant — réessaie.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return <p className="text-sm text-muted">Vérification…</p>;
  }

  if (state === "unsupported") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
        <p className="font-medium">Notifications indisponibles ici</p>
        <p className="mt-1 text-xs text-muted">
          Sur iPhone, ajoute d&apos;abord Kreatly à ton écran d&apos;accueil
          (Safari → Partager → « Sur l&apos;écran d&apos;accueil »), puis
          reviens sur cette page depuis l&apos;icône. Sur Android, Chrome
          suffit mais la PWA installée est plus fiable.
        </p>
        {message && <p className="mt-2 text-xs text-destructive">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state === "on" ? (
        <Button type="button" variant="outline" onClick={disable} disabled={busy}>
          <BellOff className="size-4" />
          Désactiver sur cet appareil
        </Button>
      ) : (
        <Button type="button" variant="accent" onClick={enable} disabled={busy}>
          <Bell className="size-4" />
          Activer les notifications
        </Button>
      )}
      {message && (
        <p className="text-xs text-muted" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

// Convertit la clé VAPID base64url en Uint8Array — format attendu par
// `pushManager.subscribe`.
function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
