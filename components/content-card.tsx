"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("content.actionMenu");
  const tContent = useTranslations("content");
  const tType = useTranslations("contentTypes");
  const tStatus = useTranslations("statuses");
  const tPlatform = useTranslations("platforms");
  const [pending, startTransition] = useTransition();

  const safeT = (fn: (k: string) => string, key: string, fallback: string) => {
    try {
      return fn(key);
    } catch {
      return fallback;
    }
  };

  return (
    <Card className="group relative h-full overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-12px_rgba(26,15,37,0.18)]">
      <Link href={`/content/${content.id}`} className="absolute inset-0 z-0" aria-label={t("open")} />

      {/* Top row : type chip + actions */}
      <div className="relative z-10 mb-3 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
          style={{
            background: `${typeColor(content.type)}1f`,
            color: typeColor(content.type),
          }}
        >
          <ColorDot color={typeColor(content.type)} />
          {safeT(tType, content.type, typeLabel(content.type))}
        </span>

        <Dropdown>
          <DropdownTrigger className="rounded-full p-1 text-muted opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100">
            <MoreVertical className="size-4" />
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem onClick={() => router.push(`/content/${content.id}`)}>
              <ExternalLink className="size-3.5" />
              {t("open")}
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
              {t("duplicate")}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownLabel>{t("changeStatus")}</DropdownLabel>
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
                {safeT(tStatus, s.value, s.label)}
                {s.value === content.status && (
                  <CheckCircle2 className="ms-auto size-3.5 text-muted" />
                )}
              </DropdownItem>
            ))}
            <DropdownSeparator />
            <DropdownItem
              destructive
              disabled={pending}
              onClick={() => {
                if (!confirm(t("confirmDelete"))) return;
                startTransition(async () => {
                  await deleteContentInPlace(content.id);
                  router.refresh();
                });
              }}
            >
              <Trash2 className="size-3.5" />
              {t("delete")}
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      {/* Title */}
      <h3 className="relative z-10 line-clamp-2 text-base font-bold leading-snug tracking-tight">
        {content.title || tContent("untitled")}
      </h3>

      {/* Footer */}
      <div className="relative z-10 mt-4 flex items-center justify-between gap-2">
        <Badge
          className="text-white"
          style={{ background: statusColor(content.status) }}
        >
          {safeT(tStatus, content.status, statusLabel(content.status))}
        </Badge>

        <div className="flex items-center gap-2 text-xs text-muted">
          {content.platform && <span>{safeT(tPlatform, content.platform, platformLabel(content.platform))}</span>}
          {content.date && content.platform && <span>·</span>}
          {content.date && <span>{formatDateFr(content.date)}</span>}
        </div>
      </div>
    </Card>
  );
}
