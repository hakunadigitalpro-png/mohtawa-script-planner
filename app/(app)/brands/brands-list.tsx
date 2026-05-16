"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Check, X, Building2, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { renameBrand, deleteBrand } from "@/app/(app)/actions";

type BrandWithRole = {
  id: string;
  name: string;
  created_by: string;
  role: string;
  content_count: number;
};

export function BrandsList({
  brands,
  currentUserId,
}: {
  brands: BrandWithRole[];
  currentUserId: string;
}) {
  return (
    <ul className="divide-y divide-border">
      {brands.map((b) => (
        <BrandRow key={b.id} brand={b} canEdit={b.role === "owner" || b.role === "admin"} canDelete={b.role === "owner"} currentUserId={currentUserId} />
      ))}
      {brands.length === 0 && (
        <li className="px-6 py-10 text-center text-sm text-muted">
          Aucune marque pour le moment.
        </li>
      )}
    </ul>
  );
}

function BrandRow({
  brand,
  canEdit,
  canDelete,
}: {
  brand: BrandWithRole;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const onSaveName = () => {
    startTransition(async () => {
      const res = await renameBrand(brand.id, name);
      if (res?.error) setError(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  };

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteBrand(brand.id);
      if (res?.error) setError(res.error);
      else {
        setDeleteOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <li className="flex items-center gap-3 px-6 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted">
        <Building2 className="size-4" />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="h-8 max-w-xs"
            />
            <Button size="sm" onClick={onSaveName} disabled={pending}>
              <Check className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(brand.name);
                setError(null);
              }}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-medium">{brand.name}</div>
            <Badge className="bg-secondary text-muted">
              {brand.role}
            </Badge>
          </div>
        )}
        <div className="text-xs text-muted">
          {brand.content_count} vidéo{brand.content_count !== 1 ? "s" : ""}
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>

      {!editing && (
        <div className="flex items-center gap-1">
          <Link
            href={`/brands/${brand.id}`}
            className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-secondary hover:text-foreground"
            aria-label="Configurer"
            title="Piliers et objectifs"
          >
            <Settings className="size-4" />
          </Link>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(true)}
              aria-label="Renommer"
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              aria-label="Supprimer"
              className="text-muted hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer « {brand.name} » ?</DialogTitle>
            <DialogDescription>
              Toutes les vidéos, scripts, storyboards et statistiques liés à cette marque
              seront définitivement perdus. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted">
              Pour confirmer, tape <span className="font-mono font-semibold text-foreground">{brand.name}</span> :
            </p>
            <Input
              className="mt-2"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={brand.name}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== brand.name || pending}
              onClick={onDelete}
            >
              {pending ? "Suppression..." : "Confirmer la suppression"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
