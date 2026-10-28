"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Copy,
  Link2,
  Plus,
  Trash2,
  Check,
  Crown,
  Shield,
  Pencil,
  Eye,
  LogOut,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn, formatDateFr, isFarFuture } from "@/lib/utils";
import {
  createBrandInvitation,
  revokeBrandInvitation,
  updateMemberRole,
  removeBrandMember,
  setMemberExpiry,
  setMemberScopes,
  type BrandRole,
} from "../team-actions";
import { SCOPES, effectiveScopes, type ScopeKey } from "@/lib/scopes";

type Member = {
  user_id: string;
  email: string;
  role: BrandRole;
  joined_at: string;
  /** NULL = accès illimité. Au-delà, la RLS coupe les accès. */
  expires_at: string | null;
  /** NULL = défaut selon le rôle. Sinon liste explicite. */
  scopes: string[] | null;
};

// Les modules et leurs défauts par rôle vivent dans lib/scopes.ts :
// une source de vérité partagée entre page Équipe, sidebar, gardes
// serveur et base (via has_brand_scope / my_brand_scopes).

/**
 * Durées d'accès proposées à l'invitation ou à la révision. Volontairement
 * courtes : un accès client dure une mission, pas une vie.
 */
const DURATIONS: { label: string; days: number | null }[] = [
  { label: "1 semaine", days: 7 },
  { label: "2 semaines", days: 14 },
  { label: "1 mois", days: 30 },
  { label: "3 mois", days: 90 },
  { label: "6 mois", days: 180 },
  { label: "Illimité", days: null },
];

/** Nombre de jours restants (positif) ou dépassés (négatif) jusqu'à une date. */
function daysUntil(iso: string): number {
  return Math.round(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

type Invitation = {
  id: string;
  role: BrandRole;
  token: string;
  note: string | null;
  created_at: string;
  expires_at: string;
};

const ROLE_ICON: Record<BrandRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

const ROLES: BrandRole[] = ["owner", "admin", "editor", "viewer"];
const INVITABLE_ROLES: BrandRole[] = ["admin", "editor", "viewer"];

export function TeamSection({
  brandId,
  currentUserId,
  currentUserRole,
  members,
  invitations,
}: {
  brandId: string;
  currentUserId: string;
  currentUserRole: BrandRole;
  members: Member[];
  invitations: Invitation[];
}) {
  const t = useTranslations("team");
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      {canManage && (
        <div
          data-tour="brand-team"
          className="flex items-center justify-between gap-3"
        >
          <p className="text-sm text-muted">{t("intro")}</p>
          <Button onClick={() => setInviteOpen(true)} size="sm">
            <Plus className="size-3.5" />
            {t("createLink")}
          </Button>
        </div>
      )}

      <MembersList
        brandId={brandId}
        currentUserId={currentUserId}
        canManage={canManage}
        members={members}
      />

      {invitations.length > 0 && (
        <InvitationsList
          brandId={brandId}
          invitations={invitations}
          canManage={canManage}
        />
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        brandId={brandId}
      />
    </div>
  );
}

// ============================================================
// Liste des membres
// ============================================================
function MembersList({
  brandId,
  currentUserId,
  canManage,
  members,
}: {
  brandId: string;
  currentUserId: string;
  canManage: boolean;
  members: Member[];
}) {
  const t = useTranslations("team");
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 bg-secondary/30 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2.5 text-start font-medium">{t("memberHeader")}</th>
            <th className="px-4 py-2.5 text-start font-medium">{t("roleHeader")}</th>
            <th className="px-4 py-2.5 text-start font-medium">Accès</th>
            <th className="px-4 py-2.5 text-start font-medium">{t("joinedHeader")}</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <MemberRow
              key={m.user_id}
              brandId={brandId}
              member={m}
              isSelf={m.user_id === currentUserId}
              canManage={canManage}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberRow({
  brandId,
  member,
  isSelf,
  canManage,
}: {
  brandId: string;
  member: Member;
  isSelf: boolean;
  canManage: boolean;
}) {
  const t = useTranslations("team");
  const tRoles = useTranslations("team.roles");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const RoleIcon = ROLE_ICON[member.role];

  // L'utilisateur peut changer le rôle s'il est admin/owner, et pas le sien
  // (pour éviter de se rétrograder accidentellement). Self-change via "Quitter".
  const canChangeRole = canManage && !isSelf;
  const canRemove = canManage || isSelf;

  const onRoleChange = (newRole: BrandRole) => {
    if (newRole === member.role) return;
    setError(null);
    startTransition(async () => {
      const res = await updateMemberRole(brandId, member.user_id, newRole);
      if ("error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  };

  const onRemove = () => {
    const message = isSelf
      ? t("leaveConfirm")
      : t("removeConfirm", { email: member.email });
    if (!confirm(message)) return;
    setError(null);
    startTransition(async () => {
      const res = await removeBrandMember(brandId, member.user_id);
      if ("error" in res && res.error) setError(res.error);
      else {
        if (isSelf) {
          // On quitte la marque → retour au dashboard
          router.push("/dashboard");
        } else {
          router.refresh();
        }
      }
    });
  };

  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">
            {member.email.charAt(0)}
          </div>
          <div>
            <div className="font-medium text-foreground">
              {member.email}
              {isSelf && (
                <span className="ms-2 text-xs text-muted">{t("selfSuffix")}</span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {canChangeRole ? (
          <Select
            value={member.role}
            onValueChange={(v) => onRoleChange(v as BrandRole)}
            disabled={pending}
            options={ROLES.map((r) => ({ value: r, label: tRoles(r) }))}
            className="w-40"
          />
        ) : (
          <Badge className="gap-1.5 bg-secondary text-foreground">
            <RoleIcon className="size-3" />
            {tRoles(member.role)}
          </Badge>
        )}
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <ScopePills
          brandId={brandId}
          member={member}
          canManage={canManage && !isSelf}
        />
      </td>
      <td className="px-4 py-3 text-muted">
        <div>{formatDateFr(new Date(member.joined_at))}</div>
        {member.expires_at ? (
          <ExpiryBadge
            brandId={brandId}
            userId={member.user_id}
            expiresAt={member.expires_at}
            canManage={canManage}
          />
        ) : canManage && member.role === "viewer" && !isSelf ? (
          <SetDurationButton
            brandId={brandId}
            userId={member.user_id}
            label="Mettre une fin d'accès"
          />
        ) : null}
      </td>
      <td className="px-4 py-3 text-end">
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={pending}
            className="text-muted hover:text-destructive"
            aria-label={isSelf ? t("leave") : t("remove")}
          >
            {isSelf ? (
              <>
                <LogOut className="size-3.5" />
                {t("leave")}
              </>
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        )}
      </td>
    </tr>
  );
}

// ============================================================
// Pastilles d'accès par section (comme Kiro CRM)
// ============================================================
function ScopePills({
  brandId,
  member,
  canManage,
}: {
  brandId: string;
  member: Member;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const effective = effectiveScopes(member.role, member.scopes);

  const toggle = (key: ScopeKey) => {
    if (!canManage) return;
    const next = effective.includes(key)
      ? effective.filter((s) => s !== key)
      : [...effective, key];
    startTransition(async () => {
      const res = await setMemberScopes(brandId, member.user_id, next);
      if ("ok" in res && res.ok) router.refresh();
    });
  };

  return (
    <div className="grid max-w-md grid-cols-2 gap-1 sm:grid-cols-4">
      {SCOPES.map((s) => {
        const on = effective.includes(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => toggle(s.key)}
            disabled={!canManage || pending}
            className={cn(
              "rounded-full px-2 py-1 text-xs font-medium transition",
              on
                ? "bg-emerald-200 !text-emerald-950 dark:bg-emerald-500/30 dark:!text-emerald-100"
                : "bg-foreground/5 text-muted hover:bg-foreground/10",
              !canManage && "cursor-default",
            )}
            title={
              canManage
                ? `${s.label} — ${s.hint}`
                : `${s.label} — ${s.hint}`
            }
          >
            {on ? "✓ " : ""}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Pastille d'expiration + bouton pour poser/changer la fin d'accès
// ============================================================
function ExpiryBadge({
  brandId,
  userId,
  expiresAt,
  canManage,
}: {
  brandId: string;
  userId: string;
  expiresAt: string;
  canManage: boolean;
}) {
  const days = daysUntil(expiresAt);
  const expired = days <= 0;
  const tone = expired
    ? "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200"
    : days <= 7
      ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
      : "bg-foreground/5 text-foreground";
  const label = expired
    ? `Expiré depuis ${-days} j`
    : `Expire dans ${days} j`;
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
        {label}
      </span>
      {canManage && (
        <SetDurationButton
          brandId={brandId}
          userId={userId}
          label="Modifier"
        />
      )}
    </div>
  );
}

function SetDurationButton({
  brandId,
  userId,
  label,
}: {
  brandId: string;
  userId: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<string>("30");

  const onSave = () => {
    const days = choice === "null" ? null : Number(choice);
    const expiresAt =
      days === null ? null : new Date(Date.now() + days * 86400_000);
    startTransition(async () => {
      const res = await setMemberExpiry(brandId, userId, expiresAt);
      if ("ok" in res && res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        {label}
      </button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Durée d&apos;accès</DialogTitle>
            <DialogDescription>
              Au-delà de cette date, la personne ne verra plus la marque.
              Tu peux changer plus tard.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Select
              value={choice}
              onValueChange={setChoice}
              options={DURATIONS.map((d) => ({
                value: d.days === null ? "null" : String(d.days),
                label: d.label,
              }))}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={onSave} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// Liste des invitations pending
// ============================================================
function InvitationsList({
  brandId,
  invitations,
  canManage,
}: {
  brandId: string;
  invitations: Invitation[];
  canManage: boolean;
}) {
  const t = useTranslations("team");
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        {t("pendingTitle", { count: invitations.length })}
      </h3>
      <div className="space-y-2">
        {invitations.map((inv) => (
          <InvitationRow
            key={inv.id}
            brandId={brandId}
            invitation={inv}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  );
}

function InvitationRow({
  brandId,
  invitation,
  canManage,
}: {
  brandId: string;
  invitation: Invitation;
  canManage: boolean;
}) {
  const t = useTranslations("team");
  const tRoles = useTranslations("team.roles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const RoleIcon = ROLE_ICON[invitation.role];

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${invitation.token}`
      : `/invite/${invitation.token}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencieux
    }
  };

  const onRevoke = () => {
    if (!confirm(t("revokeConfirm"))) return;
    startTransition(async () => {
      const res = await revokeBrandInvitation(invitation.id, brandId);
      if ("ok" in res && res.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm">
      <Link2 className="size-4 shrink-0 text-muted" />
      <Badge className="gap-1.5 bg-secondary text-foreground">
        <RoleIcon className="size-3" />
        {tRoles(invitation.role)}
      </Badge>
      {invitation.note && (
        <span className="text-muted">— {invitation.note}</span>
      )}
      <span className="text-xs text-muted">
        {isFarFuture(invitation.expires_at)
          ? t("neverExpires")
          : t("expiresOn", { date: formatDateFr(new Date(invitation.expires_at)) })}
      </span>
      <div className="ms-auto flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
        >
          {copied ? (
            <>
              <Check className="size-3.5" /> {t("copied")}
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> {t("copyLink")}
            </>
          )}
        </Button>
        {canManage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRevoke}
            disabled={pending}
            className="text-muted hover:text-destructive"
            aria-label={tCommon("delete")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Dialog de création d'invitation
// ============================================================
function InviteDialog({
  open,
  onClose,
  brandId,
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
}) {
  const t = useTranslations("team");
  const tDialog = useTranslations("team.dialog");
  const tRoles = useTranslations("team.roles");
  const tRoleDescriptions = useTranslations("team.roleDescriptions");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [role, setRole] = useState<BrandRole>("editor");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  // Par défaut : illimité pour un membre interne, 1 mois pour un client.
  // Au changement de rôle on remet la valeur par défaut adaptée.
  const [duration, setDuration] = useState<string>("null");
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState<{
    link: string;
    sentTo: string | null;
    /** L'adresse saisie quand l'e-mail n'est pas parti : on le dit. */
    failedTo: string | null;
  } | null>(null);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setRole("editor");
    setNote("");
    setEmail("");
    setDuration("null");
    setGenerated(null);
    setError(null);
    setCopied(false);
  };

  // Quand on choisit un rôle « viewer » (client), la mission a par défaut
  // une fin : on propose 1 mois. Pour un membre interne (editor/admin),
  // l'accès est illimité par défaut.
  const onRoleChange = (v: BrandRole) => {
    setRole(v);
    setDuration(v === "viewer" ? "30" : "null");
  };

  const onClose_ = () => {
    onClose();
    setTimeout(reset, 200);
    router.refresh();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createBrandInvitation(
        brandId,
        role,
        note || null,
        email.trim() || null,
        duration === "null" ? null : Number(duration),
      );
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        const link = `${window.location.origin}/invite/${res.token}`;
        setGenerated({
          link,
          sentTo: res.sentTo ?? null,
          failedTo: res.emailFailed ? email.trim() : null,
        });
      }
    });
  };

  const onCopy = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silencieux
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose_}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tDialog("title")}</DialogTitle>
          <DialogDescription>
            {generated
              ? generated.failedTo
                ? tDialog("subtitleFailed", { email: generated.failedTo })
                : tDialog("subtitleDone")
              : tDialog("subtitleForm")}
          </DialogDescription>
        </DialogHeader>

        {generated ? (
          <>
            <DialogBody className="space-y-3">
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
                <div className="break-all text-xs text-foreground/80">
                  {generated.link}
                </div>
              </div>
              {/* La réussite se voit : une coche et l'adresse, pas seulement
                  un sous-titre gris. */}
              {generated.sentTo && (
                <p className="flex items-start gap-1.5 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-status-live" aria-hidden />
                  <span className="break-all">
                    {tDialog("sentTo", { email: generated.sentTo })}
                  </span>
                </p>
              )}
              <p className="text-xs text-muted">{tDialog("linkHint")}</p>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={onClose_}>
                {tDialog("close")}
              </Button>
              <Button onClick={onCopy}>
                {copied ? (
                  <>
                    <Check className="size-4" /> {t("copied")}
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> {t("copyLink")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            {/* Tout se fige pendant l'envoi : un e-mail est le moment le
                plus lent, on ne modifie ni ne ferme en attendant. */}
            <fieldset disabled={pending} className="contents">
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-role">{tDialog("role")}</Label>
                <Select
                  id="invite-role"
                  value={role}
                  onValueChange={(v) => onRoleChange(v as BrandRole)}
                  options={INVITABLE_ROLES.map((r) => ({
                    value: r,
                    label: tRoles(r),
                  }))}
                />
                <p className="text-xs text-muted">{tRoleDescriptions(role)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-duration">Durée d&apos;accès</Label>
                <Select
                  id="invite-duration"
                  value={duration}
                  onValueChange={setDuration}
                  options={DURATIONS.map((d) => ({
                    value: d.days === null ? "null" : String(d.days),
                    label: d.label,
                  }))}
                />
                <p className="text-xs text-muted">
                  {role === "viewer"
                    ? "Un client voit la marque pendant cette durée, puis l'accès se coupe tout seul."
                    : "Laisse « Illimité » pour un membre interne. Tu peux changer plus tard."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-note">{tDialog("note")}</Label>
                <Input
                  id="invite-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={tDialog("notePlaceholder")}
                  maxLength={80}
                />
                <p className="text-xs text-muted">{tDialog("noteHint")}</p>
              </div>
              {/* Facultatif : rempli, l'invitation part aussi par e-mail.
                  L'adresse n'est pas stockée — une invitation est un lien. */}
              <div className="space-y-2">
                <Label htmlFor="invite-email">{tDialog("email")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tDialog("emailPlaceholder")}
                  autoComplete="off"
                />
                <p className="text-xs text-muted">{tDialog("emailHint")}</p>
              </div>
              {error && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose_} disabled={pending}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {pending
                  ? emailValid
                    ? tDialog("sending")
                    : tDialog("generating")
                  : emailValid
                    ? tDialog("send")
                    : tDialog("generate")}
              </Button>
            </DialogFooter>
            </fieldset>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
