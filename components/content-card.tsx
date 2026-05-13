import Link from "next/link";
import { Badge, ColorDot } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  typeColor,
  typeLabel,
  statusColor,
  statusLabel,
  platformLabel,
} from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";
import type { Content } from "@/lib/types";

export function ContentCard({ content }: { content: Content }) {
  return (
    <Link href={`/content/${content.id}`} className="block">
      <Card className="h-full p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <ColorDot color={typeColor(content.type)} />
            <span className="text-xs font-medium text-muted">
              {typeLabel(content.type)}
            </span>
          </div>
          <Badge
            className="text-white"
            style={{ background: statusColor(content.status) }}
          >
            {statusLabel(content.status)}
          </Badge>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
          {content.title || "Sans titre"}
        </h3>
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>{platformLabel(content.platform)}</span>
          {content.date && <span>{formatDateFr(content.date)}</span>}
        </div>
      </Card>
    </Link>
  );
}
