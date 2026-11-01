"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Plus, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  adminCreateAccount,
  adminExtend,
  adminResetPassword,
  adminSetStatus,
  adminSetSubscription,
  adminToggleAi,
} from "@/app/(app)/admin/actions";

export type AdminUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  plan_id: string | null;
  status: string | null;
  ends_at: string | null;
  ai_enabled: boolean | null;
  note: string | null;
  brand_count: number;
  brands: { id: string; name: string; role: string }[];
  ai_calls_today: number;
  ai_calls_month: number;
};

export type AdminPlan = {
  id: string;
  label: string;
  price_tnd: number | null;
  price_eur: number | null;
  max_brands: number | null;
  max_members: number | null;
  max_viewers: number | null;
};

type SubStatus = "trial" | "active" | "readonly" | "suspended";

const STATUS_LABELS: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  readonly: "Lecture seule",
  suspended: "Suspendu",
};

const STATUS_TONE: Record<string, string> = {
  trial: "bg-amber-100 !text-foreground dark:bg-amber-500/20",
  active: "bg-emerald-100 !text-foreground dark:bg-emerald-500/20",
  readonly: "bg-rose-100 !text-foreground dark:bg-rose-500/20",
  suspended: "bg-foreground/10 !text-foreground",
};

const ROLE_SHORT: Record<string, string> = {
  owner: "owner",
  admin: "admin",
  editor_ai: "editor IA",
  editor: "editor",
  viewer: "client",
};

/** Seuil « gros consommateur » d'IA (≈ 45 TND de coût OpenAI/Anthropic). */
const AI_HEAVY_THRESHOLD = 300;

const DURATIONS = [
  { value: "0", label: "Pas de fin" },
  { value: "14", label: "14 jours" },
  { value: "30", label: "1 mois" },
  { value: "90", label: "3 mois" },
  { value: "120", label: "4 mois" },
  { value: "180", label: "6 mois" },
  { value: "365", label: "1 an" },
];

const STATUS_OPTIONS = [
  { value: "trial", label: "Essai" },
  { value: "active", label: "Actif" },
  { value: "readonly", label: "Lecture seule" },
  { value: "suspended", label: "Suspendu" },
];

function daysLeft(iso: string | null): number | null {
  return iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86400_000) : null;
}

export function AdminUsersTable({
  users,
  plans,
  currentUserId,
}: {
  users: AdminUser[];
  plans: AdminPlan[];
  currentUserId: string;
}) {
  const [filter, setFilter] = useState<"all" | "expiring" | "suspended" | "heavy_ai">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (q && !`${u.email} ${u.full_name ?? ""} ${u.brands.map((b) => b.name).join(" ")}`.toLowerCase().includes(q)) {
      return false;
    }
    if (filter === "expiring") {
      const d = daysLeft(u.ends_at);
      return d !== null && d >= 0 && d <= 7;
    }
    if (filter === "suspended") return u.status === "suspended" || u.status === "readonly";
    if (filter === "heavy_ai") return u.ai_calls_month >= AI_HEAVY_THRESHOLD;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-full border border-border bg-card p-0.5">
          {(
            [
              { v: "all" as const, label: "Tous" },
              { v: "expiring" as const, label: "Expire dans 7 j" },
              { v: "suspended" as const, label: "Suspendus / lecture" },
              { v: "heavy_ai" as const, label: `IA > ${AI_HEAVY_THRESHOLD}/mois` },
            ]
          ).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                filter === v ? "bg-secondary text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un e-mail, un nom, une marque…"
          className="h-9 w-72 text-sm"
        />
        <Button variant="accent" size="sm" className="ms-auto" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Créer un compte
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-border/60 bg-secondary/30 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">Compte</th>
              <th className="px-4 py-2.5 text-start font-medium">Plan</th>
              <th className="px-4 py-2.5 text-start font-medium">Statut</th>
              <th className="px-4 py-2.5 text-start font-medium">Fin</th>
              <th className="px-4 py-2.5 text-start font-medium">IA</th>
              <th className="px-4 py-2.5 text-start font-medium">Usage IA</th>
              <th className="px-4 py-2.5 text-start font-medium">Marques</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                  Aucun compte dans ce filtre.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <UserRow
                  key={u.user_id}
                  user={u}
                  isMe={u.user_id === currentUserId}
                  onEdit={() => setEditing(u)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && <EditDialog user={editing} plans={plans} onClose={() => setEditing(null)} />}
      {creating && <CreateDialog plans={plans} onClose={() => setCreating(false)} />}
    </div>
  );
}

function UserRow({ user, isMe, onEdit }: { user: AdminUser; isMe: boolean; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const d = daysLeft(user.ends_at);
  const status = user.status ?? "trial";
  const blocked = status === "suspended" || status === "readonly";

  const run = (fn: () => Promise<{ ok?: true; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if ("error" in res && res.error) alert(res.error);
      else router.refresh();
    });

  const resetPassword = () => {
    if (!confirm(`Générer un nouveau mot de passe pour ${user.email} ? L'ancien ne marchera plus.`)) return;
    startTransition(async () => {
      const res = await adminResetPassword({ userId: user.user_id });
      if ("error" in res && res.error) alert(res.error);
      else if ("password" in res && res.password) setNewPassword(res.password);
    });
  };

  return (
    <tr className="border-b border-border/40 align-top last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">
          {user.full_name ?? user.email}
          {isMe && <span className="ms-2 text-xs text-muted">(toi)</span>}
        </div>
        {user.full_name && <div className="text-xs text-muted">{user.email}</div>}
        <div className="mt-0.5 text-xs text-muted">
          Inscrit le {formatDateFr(new Date(user.created_at))}
          {user.last_sign_in_at
            ? ` · vu le ${formatDateFr(new Date(user.last_sign_in_at))}`
            : " · jamais connecté"}
        </div>
        {user.note && <div className="mt-1 text-xs italic text-muted">« {user.note} »</div>}
        {newPassword && (
          <div className="mt-2 rounded-xl border border-accent/30 bg-accent/5 p-2 text-xs">
            <div className="text-muted">Nouveau mot de passe (affiché une seule fois) :</div>
            <Secret value={newPassword} />
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-foreground">{user.plan_id ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge className={STATUS_TONE[status] ?? "bg-foreground/10"}>{STATUS_LABELS[status] ?? status}</Badge>
      </td>
      <td className="px-4 py-3 text-muted">
        {user.ends_at ? (
          <>
            <div>{formatDateFr(new Date(user.ends_at))}</div>
            <div className={`text-xs ${d !== null && d <= 7 ? "text-rose-600" : ""}`}>
              {d !== null && d >= 0 ? `dans ${d} j` : d !== null ? `dépassé de ${-d} j` : ""}
            </div>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => adminToggleAi({ userId: user.user_id, enabled: !user.ai_enabled }))}
          title={user.ai_enabled ? "Désactiver l'IA" : "Activer l'IA"}
          className="rounded-full p-1 transition hover:bg-secondary"
        >
          {user.ai_enabled ? <Zap className="size-4 text-amber-600" /> : <ZapOff className="size-4 text-muted" />}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className={user.ai_calls_month >= AI_HEAVY_THRESHOLD ? "font-semibold text-rose-600" : "text-foreground"}>
          {user.ai_calls_month}
        </div>
        <div className="text-xs text-muted">{user.ai_calls_today} / 24 h</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex max-w-[260px] flex-wrap gap-1">
          {user.brands.length === 0 ? (
            <span className="text-muted">—</span>
          ) : (
            user.brands.map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.id}#team`}
                className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium !text-foreground hover:bg-foreground/10"
                title={`${b.name} · ${ROLE_SHORT[b.role] ?? b.role}`}
              >
                {b.name} <span className="opacity-60">· {ROLE_SHORT[b.role] ?? b.role}</span>
              </Link>
            ))
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => adminExtend({ userId: user.user_id, days: 30 }))} title="Ajouter 1 mois">+1m</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => adminExtend({ userId: user.user_id, days: 90 }))} title="Ajouter 3 mois">+3m</Button>
          {!isMe && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => adminSetStatus({ userId: user.user_id, status: blocked ? "active" : "suspended" }))}
            >
              {blocked ? "Réactiver" : "Suspendre"}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={resetPassword} title="Nouveau mot de passe">
            <KeyRound className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>Modifier</Button>
        </div>
      </td>
    </tr>
  );
}

/** Une valeur secrète avec bouton copier — affichée une seule fois. */
function Secret({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-2">
      <code className="rounded-md bg-card px-2 py-1 font-mono text-sm text-foreground">{value}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
        className="rounded-full p-1 text-muted hover:bg-secondary hover:text-foreground"
        aria-label="Copier"
      >
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function EditDialog({ user, plans, onClose }: { user: AdminUser; plans: AdminPlan[]; onClose: () => void }) {
  const router = useRouter();
  const [planId, setPlanId] = useState(user.plan_id ?? "free");
  const [status, setStatus] = useState<string>(user.status ?? "trial");
  const [duration, setDuration] = useState<string>(
    user.ends_at ? String(Math.max(0, daysLeft(user.ends_at) ?? 0)) : "0",
  );
  const [aiEnabled, setAiEnabled] = useState<boolean>(user.ai_enabled ?? false);
  const [note, setNote] = useState(user.note ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await adminSetSubscription({
        userId: user.user_id,
        planId,
        status: status as SubStatus,
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
          <DialogTitle>{user.full_name ?? user.email}</DialogTitle>
          <DialogDescription>Change le plan, la durée restante, l&apos;IA et la note interne.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <PlanFields
            plans={plans}
            planId={planId} setPlanId={setPlanId}
            status={status} setStatus={setStatus}
            duration={duration} setDuration={setDuration}
            aiEnabled={aiEnabled} setAiEnabled={setAiEnabled}
            durationLabel="Durée restante (0 = pas de fin)"
          />
          <div>
            <label className="mb-1 block text-xs text-muted">Note (interne)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. offert 4 mois, payé 29 TND…" />
          </div>
          {error && <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Les champs d'abonnement, partagés entre « Modifier » et « Créer un compte ». */
function PlanFields(p: {
  plans: AdminPlan[];
  planId: string; setPlanId: (v: string) => void;
  status: string; setStatus: (v: string) => void;
  duration: string; setDuration: (v: string) => void;
  aiEnabled: boolean; setAiEnabled: (v: boolean) => void;
  durationLabel: string;
}) {
  const plan = p.plans.find((x) => x.id === p.planId);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">Plan</label>
          <Select value={p.planId} onValueChange={p.setPlanId} options={p.plans.map((x) => ({ value: x.id, label: x.label }))} />
          {plan && (
            <p className="mt-1 text-[11px] text-muted">
              {plan.max_brands ?? "∞"} marque{(plan.max_brands ?? 2) > 1 ? "s" : ""} · {plan.max_members ?? "∞"} membres · {plan.max_viewers ?? "∞"} clients
              {plan.price_tnd ? ` · ${plan.price_tnd} TND / ${plan.price_eur} €` : ""}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Statut</label>
          <Select value={p.status} onValueChange={p.setStatus} options={STATUS_OPTIONS} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">{p.durationLabel}</label>
        <Select value={p.duration} onValueChange={p.setDuration} options={DURATIONS} />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={p.aiEnabled} onChange={(e) => p.setAiEnabled(e.target.checked)} className="size-4 rounded border-border" />
        Activer l&apos;IA pour ce compte
      </label>
    </>
  );
}

function CreateDialog({ plans, onClose }: { plans: AdminPlan[]; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [planId, setPlanId] = useState("agence");
  const [status, setStatus] = useState<string>("active");
  const [duration, setDuration] = useState<string>("120");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [note, setNote] = useState("");
  const [send, setSend] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; password: string; emailed: boolean; brandId: string | null } | null>(null);

  const create = () =>
    startTransition(async () => {
      setError(null);
      const res = await adminCreateAccount({
        email,
        fullName: fullName || null,
        planId,
        status: status as SubStatus,
        durationDays: Number(duration) || null,
        aiEnabled,
        brandName: brandName || null,
        sendEmail: send,
        note: note || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        if ("password" in res && res.password) {
          setDone({ email: email.trim().toLowerCase(), password: res.password, emailed: false, brandId: null });
        }
        return;
      }
      if ("ok" in res && res.ok) {
        setDone({ email: res.email, password: res.password, emailed: res.emailed, brandId: res.brandId });
        router.refresh();
      }
    });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{done ? "Compte créé" : "Créer un compte"}</DialogTitle>
          <DialogDescription>
            {done
              ? "Note ces identifiants maintenant : le mot de passe ne sera plus affiché."
              : "L'e-mail est confirmé d'office, un mot de passe initial est généré, l'abonnement est posé."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <>
            <DialogBody className="space-y-3">
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
                <div className="text-xs text-muted">Identifiant</div>
                <Secret value={done.email} />
                <div className="mt-3 text-xs text-muted">Mot de passe</div>
                <Secret value={done.password} />
              </div>
              <p className="text-xs text-muted">
                {done.emailed
                  ? `Un e-mail avec ces identifiants est parti à ${done.email}.`
                  : "Aucun e-mail envoyé : transmets ces identifiants toi-même (WhatsApp, appel…)."}
                {done.brandId ? " Sa marque est créée, il en est propriétaire." : ""}
              </p>
              {error && <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button onClick={onClose}>Fermer</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="space-y-4">
              <fieldset disabled={pending} className="contents">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted">E-mail *</label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@entreprise.com" autoComplete="off" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Nom (optionnel)</label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Sami Ben Ali" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Première marque (optionnel)</label>
                  <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Ex. DIMPO — créée avec lui comme propriétaire" />
                </div>
                <PlanFields
                  plans={plans}
                  planId={planId} setPlanId={setPlanId}
                  status={status} setStatus={setStatus}
                  duration={duration} setDuration={setDuration}
                  aiEnabled={aiEnabled} setAiEnabled={setAiEnabled}
                  durationLabel="Durée d'accès (0 = pas de fin)"
                />
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="size-4 rounded border-border" />
                  Lui envoyer ses identifiants par e-mail
                </label>
                <div>
                  <label className="mb-1 block text-xs text-muted">Note (interne)</label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. offert 4 mois, contrat signé le…" />
                </div>
              </fieldset>
              {error && <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
              <Button variant="accent" onClick={create} disabled={pending || !email.trim()} aria-busy={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Créer le compte
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
