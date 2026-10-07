import { PlanMyDay } from "@/components/today/plan-my-day";
import { DayTimeline } from "@/components/today/day-timeline";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionHeader } from "@/components/ui/section-header";
import { getTodayTimeline } from "@/lib/server/home";
import { getSetting, listTasks, DEFAULT_WINDOW } from "@/lib/server/data";
import type { DayWindow } from "@/lib/planner";
import { localDate, TZ } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = localDate();
  const [timeline, window, tasks] = await Promise.all([getTodayTimeline(today), getSetting<DayWindow>("day_window", DEFAULT_WINDOW), listTasks()]);
  const doneIds = tasks.filter((t) => t.status === "done").map((t) => t.id);

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-[30px] font-semibold leading-none">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: TZ })}, <em>planned</em>.
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: TZ })}
          {timeline.hasTimetable ? ` · ${timeline.classes} on the timetable` : " · no timetable added yet"}
        </p>
      </div>

      <div className="mb-6">
        <PlanMyDay today={today} window={window} hasSaved={timeline.planned} hasTimetable={timeline.hasTimetable} />
      </div>

      <GlassCard hover={false} className="p-5">
        <SectionHeader title={timeline.planned ? "Today's plan" : "Timetable"} subtitle={timeline.planned ? "Tick tasks off as you go" : "Generate a plan above to fill the gaps"} />
        <DayTimeline blocks={timeline.blocks} doneIds={doneIds} />
      </GlassCard>
    </div>
  );
}
