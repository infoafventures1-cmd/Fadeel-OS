import { ExternalLink, Lock, FileText, PlaySquare, AlignLeft } from "lucide-react";
import { ACCESS_LABEL, SOURCE_TYPE_LABEL, topicByKey, type EdgeItem } from "@/lib/edge";
import { TZ } from "@/lib/time";
import { cn } from "@/lib/utils";

export const fmtDate = (iso: string | null, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", timeZone: TZ, ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) })
    : "date unknown";

/** "YYYY-MM-DD" → "Tue 7 Oct" without timezone drift */
export const fmtDay = (day: string, weekday = true) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { ...(weekday ? { weekday: "short" } : {}), day: "numeric", month: "short", timeZone: "UTC" });

const ACCESS_ICON = { full: FileText, excerpt: AlignLeft, headline: AlignLeft, paywalled: Lock, video: PlaySquare } as const;

export function AccessBadge({ access, className }: { access: EdgeItem["access"]; className?: string }) {
  const Icon = ACCESS_ICON[access];
  const tone = access === "full" ? "text-emerald border-emerald/25 bg-emerald/[0.07]" : access === "paywalled" ? "text-amber border-amber/25 bg-amber/[0.07]" : "text-muted border-hairline bg-tint/[0.03]";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium", tone, className)} title={ACCESS_LABEL[access]}>
      <Icon size={10} />
      {ACCESS_LABEL[access]}
    </span>
  );
}

export function TypeBadge({ type }: { type: EdgeItem["sourceType"] }) {
  const tone = type === "company" ? "text-amber" : type === "commentary" || type === "preliminary" ? "text-sky" : type === "official" || type === "filing" || type === "research" ? "text-emerald" : "text-muted";
  return <span className={cn("rounded-md border border-hairline px-1.5 py-0.5 text-[10.5px] font-medium", tone)}>{SOURCE_TYPE_LABEL[type]}</span>;
}

export function TopicChip({ topic }: { topic: EdgeItem["topic"] }) {
  const t = topic ? topicByKey(topic) : null;
  if (!t) return null;
  return <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10.5px] font-medium text-accent">{t.short}</span>;
}

/** Publisher, the three dates (published / event / retrieved) and the link to the original */
export function SourceLine({ item, showRetrieved = true }: { item: EdgeItem; showRetrieved?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-2">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-muted hover:text-accent">
        {item.publisher || item.domain} <ExternalLink size={10} />
      </a>
      <span>· Published {fmtDate(item.publishedAt)}</span>
      {item.eventDate && <span>· Event {fmtDay(item.eventDate, false)}</span>}
      {showRetrieved && item.retrievedAt && <span>· Retrieved {fmtDate(item.retrievedAt, true)}</span>}
    </div>
  );
}
