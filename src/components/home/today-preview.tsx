import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionHeader } from "@/components/ui/section-header";
import type { PlanBlock } from "@/lib/planner";
import { localMinutes, fromHHMM } from "@/lib/time";
import { cn } from "@/lib/utils";

export function TodayPreview({ blocks, planned, hasTimetable }: { blocks: PlanBlock[]; planned: boolean; hasTimetable: boolean }) {
  const now = localMinutes();
  const upcoming = blocks.filter((b) => b.kind !== "break" && fromHHMM(b.end) > now).slice(0, 7);

  return (
    <GlassCard hover={false} className="p-5">
      <SectionHeader
        title="Today"
        subtitle={planned ? "Your saved plan" : hasTimetable ? "Timetable only. Not planned yet" : "No timetable or plan yet"}
        action={
          <Link href="/today" className="flex items-center gap-1 text-[12px] text-accent hover:underline">
            {planned ? "Full day" : "Plan it"} <ArrowUpRight size={12} />
          </Link>
        }
      />
      {upcoming.length === 0 ? (
        <p className="text-[12.5px] text-muted">Nothing left on the schedule today.</p>
      ) : (
        <div className="space-y-1">
          {upcoming.map((b) => {
            const live = fromHHMM(b.start) <= now && now < fromHHMM(b.end);
            return (
              <div key={b.id} className={cn("flex items-center gap-3 rounded-lg px-1.5 py-2", live && "bg-accent/10")}>
                <span className="w-[44px] shrink-0 text-[11.5px] tabular text-muted-2">{b.start}</span>
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", b.kind === "fixed" ? "bg-sky" : "bg-accent")} />
                <span className="truncate text-[13px] text-foreground">{b.title}</span>
                {live && <span className="ml-auto font-mono text-[10px] uppercase text-accent">Now</span>}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
