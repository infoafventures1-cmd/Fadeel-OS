import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { getBriefing, getItems } from "@/lib/server/edge/store";
import { localDate } from "@/lib/time";

const fmtDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Home: the briefing date, the top story and the way in */
export async function DailyEdgeCard() {
  let briefing: Awaited<ReturnType<typeof getBriefing>> = null;
  try {
    briefing = await getBriefing();
  } catch {
    briefing = null;
  }
  const top = briefing?.data.stories[0];
  const item = top ? (await getItems([top.itemId]))[0] : null;
  const stale = briefing ? briefing.day < localDate() : false;

  return (
    <GlassCard hover={false} className="overflow-hidden p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
          <Zap size={12} className="text-accent" /> Daily Edge
        </p>
        {briefing && <span className={stale ? "text-[11px] font-medium text-amber" : "text-[11px] text-muted-2"}>{stale ? `From ${fmtDay(briefing.day)}` : fmtDay(briefing.day)}</span>}
      </div>
      {item ? (
        <>
          <p className="mt-2.5 line-clamp-3 text-[14.5px] font-semibold leading-snug text-foreground">{item.title}</p>
          <p className="mt-1 text-[11.5px] text-muted-2">
            {item.publisher}
            {briefing!.data.stories.length > 1 ? ` · +${briefing!.data.stories.length - 1} more` : ""}
          </p>
        </>
      ) : (
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{briefing ? "Quiet day: no development met the bar. There's still a concept and an exercise." : "Your research briefing on AI, finance and African fintech. Not set up yet."}</p>
      )}
      <Link href="/edge" className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-[13px] font-medium text-white transition hover:bg-accent-dim">
        {briefing ? `Start my ${Math.max(briefing.data.coreMinutes, 5)}-minute briefing` : "Set up Daily Edge"} <ArrowRight size={14} />
      </Link>
    </GlassCard>
  );
}
