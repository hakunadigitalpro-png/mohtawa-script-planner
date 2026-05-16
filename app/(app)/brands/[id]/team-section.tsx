"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

const ROLE_LABEL: Record<BrandRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  editor: "Éditeur",
  viewer: "Lecteur",
};

const ROLE_DESCRIPTION: Record<BrandRole, string> = {
  owner: "Tout faire, y compris supprimer la marque",
  admin: "Tout faire sauf supprimer la marque",
  editor: "Créer et modifier les vidéos",
  viewer: "Consulter uniquement (lecture seule)",
};

const ROLE_ICON: Record<BrandRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

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
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Invite ton équipe avec un lien à copier et envoyer où tu veux
            (WhatsApp, mail, Slack…). Chaque lien expire au bout de 30 jours.
          </p>
          <Button onClick={() => setInviteOpen(true)} size="sm">
            <Plus className="size-3.5" />
            Créer un lien d&apos;invitation
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
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 bg-secondary/30 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2.5 text-start font-medium">Membre</th>
            <th className="px-4 py-2.5 text-start font-medium">Rôle</th>
            <th className="px-4 py-2.5 text-start font-medium">Depuis</th>
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
      ? `Quitter cette marque ?\n\nTu perdras l'accès à toutes les vidéos.`
      : `Retirer ${member.email} de la marque ?`;
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
                <span className="ms-2 text-xs text-muted">(toi)</span>
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
            options={(["owner", "admin", "editor", "viewer"] as BrandRole[]).map(
              (r) => ({ value: r, label: ROLE_LABEL[r] }),
            )}
            className="w-40"
          />
        ) : (
          <Badge className="gap-1.5 bg-secondary text-foreground">
            <RoleIcon className="size-3" />
            {ROLE_LABEL[member.role]}
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
            aria-label={isSelf ? "Quitter" : "Retirer"}
          >
            {isSelf ? (
              <>
                <LogOut className="size-3.5" />
                Quitter
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
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        Invitations en attente ({invitations.length})
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
    if (!confirm("Révoquer cette invitation ?\n\nLe lien ne fonctionnera plus.")) return;
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
        {ROLE_LABEL[invitation.role]}
      </Badge>
      {invitation.note && (
        <span className="text-muted">— {invitation.note}</span>
      )}
      <span className="text-xs text-muted">
        expire le {formatDateFr(new Date(invitation.expires_at))}
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
              <Check className="size-3.5" /> Copié
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copier le lien
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
            aria-label="Révoquer"
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
          <DialogTitle>Créer un lien d&apos;invitation</DialogTitle>
          <DialogDescription>
            {generated
              ? "Le lien est prêt. Copie-le et envoie-le à la personne que tu veux inviter."
              : "Choisis le rôle que la personne aura quand elle rejoindra."}
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
              <p className="text-xs text-muted">
                Tu peux toujours retrouver ce lien plus tard dans la liste « Invitations
                en attente » en bas de cette page.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={onClose_}>
                Fermer
              </Button>
              <Button onClick={onCopy}>
                {copied ? (
                  <>
                    <Check className="size-4" /> Lien copié
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copier le lien
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-role">Rôle</Label>
                <Select
                  id="invite-role"
                  value={role}
                  onValueChange={(v) => setRole(v as BrandRole)}
                  options={(["admin", "editor", "viewer"] as BrandRole[]).map(
                    (r) => ({ value: r, label: ROLE_LABEL[r] }),
                  )}
                />
                <p className="text-xs text-muted">
                  {ROLE_DESCRIPTION[role]}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-note">
                  Note (optionnel)
                </Label>
                <Input
                  id="invite-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex : pour Sami (monteur)"
                  maxLength={80}
                />
                <p className="text-xs text-muted">
                  Pour t&apos;aider à te souvenir à qui ce lien est destiné.
                </p>
              </div>
              {error && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose_}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Génération…" : "Générer le lien"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
