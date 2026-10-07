import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { listTasks, listTimetable, getDayPlan, getSetting } from "@/lib/server/data";
import { slotsForDay } from "@/lib/planner";
import { addDays, formatDay, localDate, isoWeekday } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const today = localDate();
  const monday = addDays(today, 1 - isoWeekday(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [slots, tasks, week, plans] = await Promise.all([
    listTimetable(),
    listTasks(),
    getSetting<string | null>("timetable_week", null),
    Promise.all(days.map((d) => getDayPlan(d))),
  ]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-6">
        <h1 className="text-[30px] font-semibold leading-none">
          This <em>week</em>.
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          Timetable, saved plans and task due dates.{" "}
          {slots.length === 0 && (
            <Link href="/settings" className="text-accent hover:underline">
              Add your timetable in Settings →
            </Link>
          )}
        </p>
      </div>
      <div className="grid gap-2.5 md:grid-cols-7">
        {days.map((d, i) => {
          const plan = plans[i];
          const fixed = slotsForDay(slots, isoWeekday(d), week);
          const due = tasks.filter((t) => t.status !== "done" && t.deadline && localDate(t.deadline) === d);
          const items = plan
            ? plan.filter((b) => b.kind !== "break")
            : fixed.map((s) => ({ id: s.id, start: s.starts, title: s.title, kind: "fixed" as const }));
          return (
            <GlassCard key={d} hover={false} className={cn("min-h-[160px] p-3", d === today && "border-accent/50")}>
              <div className="mb-2 flex items-baseline justify-between">
                <p className={cn("font-mono text-[11px] uppercase tracking-wider", d === today ? "text-accent" : "text-muted-2")}>
                  {formatDay(d, { weekday: "short" })}
                </p>
                <p className="text-[18px] font-semibold tabular">{Number(d.slice(8))}</p>
              </div>
              {due.map((t) => (
                <Link key={t.id} href="/tasks" className="mb-1 block truncate rounded-md bg-rose/10 px-1.5 py-1 text-[10.5px] text-rose">
                  Due: {t.title}
                </Link>
              ))}
              <div className="space-y-1">
                {items.map((b) => (
                  <div
                    key={b.id}
                    className={cn("truncate rounded-md px-1.5 py-1 text-[10.5px]", b.kind === "fixed" ? "bg-sky/10 text-sky" : "bg-accent/10 text-accent")}
                  >
                    {b.start} {b.title}
                  </div>
                ))}
                {items.length === 0 && due.length === 0 && <p className="text-[11px] text-muted-2">Free</p>}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
