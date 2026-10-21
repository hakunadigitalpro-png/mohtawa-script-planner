"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDateFr } from "@/lib/utils";
import { adminExtend, adminSetSubscription } from "@/app/(app)/admin/actions";

type AdminUser = {
  user_id: string;
  email: string;
  created_at: string;
  plan_id: string | null;
  status: string | null;
  ends_at: string | null;
  ai_enabled: boolean | null;
  brand_count: number;
};

type Plan = {
  id: string;
  label: string;
};

const STATUS_LABELS: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  readonly: "Lecture seule",
  suspended: "Suspendu",
};

const STATUS_TONE: Record<string, string> = {
  trial: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  readonly: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200",
  suspended: "bg-foreground/10 text-foreground",
};

export function AdminUsersTable({
  users,
  plans,
}: {
  users: AdminUser[];
  plans: Plan[];
}) {
  const [filter, setFilter] = useState<"all" | "expiring" | "suspended">("all");
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const filtered = users.filter((u) => {
    if (filter === "expiring") {
      if (!u.ends_at) return false;
      const d = Math.round(
        (new Date(u.ends_at).getTime() - Date.now()) / 86400_000,
      );
      return d >= 0 && d <= 7;
    }
    if (filter === "suspended") return u.status === "suspended";
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="inline-flex gap-0.5 rounded-full border border-border bg-card p-0.5">
        {(
          [
            { v: "all" as const, label: "Tous" },
            { v: "expiring" as const, label: "Expire dans 7 j" },
            { v: "suspended" as const, label: "Suspendus" },
          ]
        ).map(({ v, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === v
                ? "bg-secondary text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-secondary/30 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">Compte</th>
              <th className="px-4 py-2.5 text-start font-medium">Plan</th>
              <th className="px-4 py-2.5 text-start font-medium">Statut</th>
              <th className="px-4 py-2.5 text-start font-medium">Fin</th>
              <th className="px-4 py-2.5 text-start font-medium">IA</th>
              <th className="px-4 py-2.5 text-start font-medium">Marques</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  Aucun compte dans ce filtre.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <UserRow key={u.user_id} user={u} onEdit={() => setEditing(u)} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditDialog
          user={editing}
          plans={plans}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function UserRow({ user, onEdit }: { user: AdminUser; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const days = user.ends_at
    ? Math.round(
        (new Date(user.ends_at).getTime() - Date.now()) / 86400_000,
      )
    : null;
  const extend = (d: number) =>
    startTransition(async () => {
      const res = await adminExtend({ userId: user.user_id, days: d });
      if ("ok" in res && res.ok) router.refresh();
    });
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{user.email}</div>
        <div className="text-xs text-muted">
          Inscrit le {formatDateFr(new Date(user.created_at))}
        </div>
      </td>
      <td className="px-4 py-3 text-foreground">{user.plan_id ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge
          className={`gap-1.5 ${STATUS_TONE[user.status ?? "trial"] ?? "bg-foreground/10"}`}
        >
          {STATUS_LABELS[user.status ?? "trial"] ?? user.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-muted">
        {user.ends_at ? (
          <div>
            <div>{formatDateFr(new Date(user.ends_at))}</div>
            <div className={days !== null && days <= 7 ? "text-xs text-rose-600" : "text-xs"}>
              {days !== null && days >= 0
                ? `dans ${days} j`
                : days !== null
                  ? `expiré depuis ${-days} j`
                  : ""}
            </div>
          </div>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        {user.ai_enabled ? (
          <Zap className="size-4 text-amber-600" aria-label="IA activée" />
        ) : (
          <ZapOff className="size-4 text-muted" aria-label="IA désactivée" />
        )}
      </td>
      <td className="px-4 py-3 text-foreground">{user.brand_count}</td>
      <td className="px-4 py-3 text-end">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => extend(30)}
            disabled={pending}
            title="Ajouter 1 mois"
          >
            +1m
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => extend(90)}
            disabled={pending}
            title="Ajouter 3 mois"
          >
            +3m
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            Modifier
          </Button>
        </div>
      </td>
    </tr>
  );
}

function EditDialog({
  user,
  plans,
  onClose,
}: {
  user: AdminUser;
  plans: Plan[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(user.plan_id ?? "free");
  const [status, setStatus] = useState(user.status ?? "trial");
  const [duration, setDuration] = useState<string>(
    user.ends_at
      ? String(
          Math.max(
            0,
            Math.round(
              (new Date(user.ends_at).getTime() - Date.now()) / 86400_000,
            ),
          ),
        )
      : "0",
  );
  const [aiEnabled, setAiEnabled] = useState<boolean>(user.ai_enabled ?? false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await adminSetSubscription({
        userId: user.user_id,
        planId,
        status: status as "trial" | "active" | "readonly" | "suspended",
        durationDays: Number(duration) || null,
        aiEnabled,
        note: note || null,
      });
      if ("error" in res && res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.email}</DialogTitle>
          <DialogDescription>
            Change le plan, la durée restante et l&apos;accès à l&apos;IA.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Plan</label>
              <Select
                value={planId}
                onValueChange={setPlanId}
                options={plans.map((p) => ({ value: p.id, label: p.label }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Statut</label>
              <Select
                value={status}
                onValueChange={setStatus}
                options={[
                  { value: "trial", label: "Essai" },
                  { value: "active", label: "Actif" },
                  { value: "readonly", label: "Lecture seule" },
                  { value: "suspended", label: "Suspendu" },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">
              Durée en jours (0 = pas de fin)
            </label>
            <Select
              value={duration}
              onValueChange={setDuration}
              options={[
                { value: "0", label: "Pas de fin" },
                { value: "14", label: "14 jours" },
                { value: "30", label: "1 mois" },
                { value: "90", label: "3 mois" },
                { value: "120", label: "4 mois" },
                { value: "180", label: "6 mois" },
                { value: "365", label: "1 an" },
              ]}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Activer l&apos;IA pour ce compte
          </label>
          <div>
            <label className="mb-1 block text-xs text-muted">Note (interne)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. offert 4 mois, payé 29 TND, etc."
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
