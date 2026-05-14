"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Copy, Trash2, ExternalLink, CheckCircle2 } from "lucide-react";
import { Badge, ColorDot } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/ui/dropdown";
import {
  typeColor,
  typeLabel,
  statusColor,
  statusLabel,
  platformLabel,
  STATUSES,
} from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";
import {
  duplicateContent,
  quickChangeStatus,
  deleteContentInPlace,
} from "@/app/(app)/contents/actions";
import type { Content } from "@/lib/types";

export function ContentCard({ content }: { content: Content }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="group relative h-full p-4 transition-shadow hover:shadow-md">
      <Link href={`/content/${content.id}`} className="absolute inset-0 z-0" aria-label="Ouvrir" />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ColorDot color={typeColor(content.type)} />
          <span className="text-xs font-medium text-muted">
            {typeLabel(content.type)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Badge
            className="text-white"
            style={{ background: statusColor(content.status) }}
          >
            {statusLabel(content.status)}
          </Badge>
          <Dropdown>
            <DropdownTrigger className="-mr-1 rounded-md p-1 text-muted hover:bg-accent hover:text-foreground">
              <MoreVertical className="size-4" />
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onClick={() => router.push(`/content/${content.id}`)}>
                <ExternalLink className="size-3.5" />
                Ouvrir
              </DropdownItem>
              <DropdownItem
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await duplicateContent(content.id);
                    if (res?.id) router.push(`/content/${res.id}`);
                  });
                }}
              >
                <Copy className="size-3.5" />
                Dupliquer
              </DropdownItem>
              <DropdownSeparator />
              <DropdownLabel>Changer le statut</DropdownLabel>
              {STATUSES.map((s) => (
                <DropdownItem
                  key={s.value}
                  disabled={pending || s.value === content.status}
                  onClick={() => {
                    startTransition(async () => {
                      await quickChangeStatus(content.id, s.value);
                      router.refresh();
                    });
                  }}
                >
                  <ColorDot color={s.color} />
                  {s.label}
                  {s.value === content.status && (
                    <CheckCircle2 className="ml-auto size-3.5 text-muted" />
                  )}
                </DropdownItem>
              ))}
              <DropdownSeparator />
              <DropdownItem
                destructive
                disabled={pending}
                onClick={() => {
                  if (!confirm("Supprimer cette vidéo ? Cette action est définitive.")) return;
                  startTransition(async () => {
                    await deleteContentInPlace(content.id);
                    router.refresh();
                  });
                }}
              >
                <Trash2 className="size-3.5" />
                Supprimer
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      <h3 className="relative z-10 mt-2 line-clamp-2 text-sm font-semibold leading-snug">
        {content.title || "Sans titre"}
      </h3>
      <div className="relative z-10 mt-3 flex items-center justify-between text-xs text-muted">
        <span>{platformLabel(content.platform)}</span>
        {content.date && <span>{formatDateFr(content.date)}</span>}
      </div>
    </Card>
  );
}
