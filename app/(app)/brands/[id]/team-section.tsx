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
import { formatDateFr } from "@/lib/utils";
import {
  createBrandInvitation,
  revokeBrandInvitation,
  updateMemberRole,
  removeBrandMember,
  type BrandRole,
} from "../team-actions";

type Member = {
  user_id: string;
  email: string;
  role: BrandRole;
  joined_at: string;
};

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
        <div className="flex items-center justify-between gap-3">
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
      <td className="px-4 py-3 text-muted">
        {formatDateFr(new Date(member.joined_at))}
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
        {t("expiresOn", { date: formatDateFr(new Date(invitation.expires_at)) })}
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
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState<{ link: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setRole("editor");
    setNote("");
    setGenerated(null);
    setError(null);
    setCopied(false);
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
      const res = await createBrandInvitation(brandId, role, note || null);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        const link = `${window.location.origin}/invite/${res.token}`;
        setGenerated({ link });
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
            {generated ? tDialog("subtitleDone") : tDialog("subtitleForm")}
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
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-role">{tDialog("role")}</Label>
                <Select
                  id="invite-role"
                  value={role}
                  onValueChange={(v) => setRole(v as BrandRole)}
                  options={INVITABLE_ROLES.map((r) => ({
                    value: r,
                    label: tRoles(r),
                  }))}
                />
                <p className="text-xs text-muted">{tRoleDescriptions(role)}</p>
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
              {error && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose_}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? tDialog("generating") : tDialog("generate")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
