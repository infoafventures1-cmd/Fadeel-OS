"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wand2, RotateCcw, Save, SkipForward, Settings2, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { DayTimeline } from "@/components/today/day-timeline";
import { clearPlanAction, generatePlanAction, saveDayWindowAction, savePlanAction } from "@/app/actions";
import type { DayWindow, PlanResult } from "@/lib/planner";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/utils";

const hm = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

// One routine item per line: "16:30-17:30 Gym (weekdays)" · add "flexible" for time the planner may use when work can't wait
const routineToText = (r: DayWindow["routine"]) =>
  (r ?? []).map((x) => `${x.start}-${x.end} ${x.title}${x.days || x.flexible ? ` (${[x.days, x.flexible && "flexible"].filter(Boolean).join(", ")})` : ""}`).join("\n");
const textToRoutine = (t: string): NonNullable<DayWindow["routine"]> =>
  t
    .split("\n")
    .map((l) => l.trim().match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s+(.+?)(?:\s*\(([^)]*)\))?$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => {
      const tags = (m[4] ?? "").toLowerCase();
      return {
        start: m[1].padStart(5, "0"),
        end: m[2].padStart(5, "0"),
        title: m[3],
        ...(tags.includes("weekday") ? { days: "weekdays" as const } : tags.includes("weekend") ? { days: "weekends" as const } : {}),
        ...(tags.includes("flex") ? { flexible: true } : {}),
      };
    });

export function PlanMyDay({ today, window, hasSaved, hasTimetable }: { today: string; window: DayWindow; hasSaved: boolean; hasTimetable: boolean }) {
  const [day, setDay] = useState(today);
  const [plan, setPlan] = useState<(PlanResult & { day: string }) | null>(null);
  const [skip, setSkip] = useState<string[]>([]);
  const [win, setWin] = useState(window);
  const [showSettings, setShowSettings] = useState(false);
  const [routineText, setRoutineText] = useState(routineToText(window.routine));
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const generate = (nextSkip = skip, forDay = day) =>
    start(async () => {
      setSaved(false);
      setPlan(await generatePlanAction(forDay, nextSkip));
    });

  const skipTask = (taskId: string) => {
    const next = [...skip, taskId];
    setSkip(next);
    generate(next);
  };

  const tasksPlanned = plan?.blocks.filter((b) => b.kind === "task") ?? [];

  return (
    <GlassCard hover={false} className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wand2 size={15} className="text-accent" />
          <p className="text-[14px] font-semibold text-foreground">Plan My Day</p>
          <div className="ml-2 flex rounded-lg border border-hairline p-0.5">
            {[
              [today, "Today"],
              [addDays(today, 1), "Tomorrow"],
            ].map(([d, label]) => (
              <button
                key={d}
                onClick={() => {
                  setDay(d);
                  setSkip([]);
                  if (plan) generate([], d);
                }}
                className={cn("rounded-md px-2.5 py-1 text-[11.5px] transition", day === d ? "bg-tint/10 text-foreground" : "text-muted hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Planning settings"
            className={cn("flex h-8 w-8 items-center justify-center rounded-lg border transition", showSettings ? "border-accent/40 text-accent" : "border-hairline text-muted hover:text-foreground")}
          >
            <Settings2 size={14} />
          </button>
          {hasSaved && day === today && (
            <button
              onClick={() => start(() => clearPlanAction(today))}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-hairline px-2.5 text-[12px] text-muted hover:text-foreground"
            >
              <RotateCcw size={12} /> Clear saved
            </button>
          )}
          <button
            onClick={() => {
              setSkip([]);
              generate([]);
            }}
            disabled={pending}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-medium text-white transition hover:bg-accent-dim disabled:opacity-60"
          >
            <Wand2 size={12} />
            {pending ? "Planning…" : plan ? "Re-plan" : hasSaved && day === today ? "Re-plan today" : "Plan it"}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-hairline p-3 sm:grid-cols-5">
          {(
            [
              ["start", "Weekdays start", "time"],
              ["weekendStart", "Weekends start", "time"],
              ["end", "Stop by", "time"],
              ["breakEvery", "Break after (min)", "number"],
              ["breakMinutes", "Break length (min)", "number"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2">
              {label}
              <input
                type={type}
                value={win[key] ?? ""}
                onChange={(e) => setWin({ ...win, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                onBlur={() => start(() => saveDayWindowAction(win))}
                className="rounded-lg border border-hairline bg-tint/[0.03] px-2 py-1.5 text-[12.5px] normal-case text-foreground focus:outline-none"
              />
            </label>
          ))}
          <label className="col-span-2 flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2 sm:col-span-5">
            Routine, one per line. Add (weekdays) or (weekends); add (flexible) for time only used when work can&rsquo;t wait
            <textarea
              rows={4}
              value={routineText}
              onChange={(e) => setRoutineText(e.target.value)}
              onBlur={() => {
                const next = { ...win, routine: textToRoutine(routineText) };
                setWin(next);
                start(() => saveDayWindowAction(next));
              }}
              className="resize-y rounded-lg border border-hairline bg-tint/[0.03] px-2 py-1.5 font-mono text-[12px] normal-case tracking-normal text-foreground focus:outline-none"
            />
          </label>
        </div>
      )}

      {!plan && (
        <p className="mt-3 text-justify text-[12.5px] leading-relaxed text-muted">
          Works around {hasTimetable ? "your timetable" : "your timetable (once it's added)"} and fills the free gaps with your open tasks: overdue and
          high-priority work first, deadlines next, each block as long as the task&rsquo;s estimate (30 min if you haven&rsquo;t set one). Long tasks get split,
          and you get a break after long stretches. Waiting-on items are left out.
        </p>
      )}

      <AnimatePresence>
        {plan && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
              <span className="rounded-lg border border-hairline px-2.5 py-1 text-muted">{hm(plan.freeMinutes)} free</span>
              <span className="rounded-lg border border-accent/30 px-2.5 py-1 text-accent">{hm(plan.focusMinutes)} planned</span>
              <span className="rounded-lg border border-hairline px-2.5 py-1 text-muted">{new Set(tasksPlanned.map((b) => b.taskId)).size} tasks</span>
              {skip.length > 0 && (
                <button onClick={() => { setSkip([]); generate([]); }} className="rounded-lg border border-hairline px-2.5 py-1 text-muted-2 hover:text-foreground">
                  {skip.length} skipped · reset
                </button>
              )}
            </div>

            {plan.blocks.length === 0 ? (
              <p className="text-[13px] text-muted">No open tasks to plan. Add some on the Tasks page.</p>
            ) : (
              <div className="space-y-1.5">
                <DayTimeline blocks={plan.blocks} isToday={plan.day === today} />
                <div className="flex flex-wrap gap-1.5 pl-5 pt-1">
                  {[...new Map(tasksPlanned.map((b) => [b.taskId!, b.title])).entries()].map(([id, title]) => (
                    <button
                      key={id}
                      onClick={() => skipTask(id)}
                      className="flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[11px] text-muted-2 hover:border-rose/40 hover:text-rose"
                      title="Leave this out today"
                    >
                      <SkipForward size={10} /> {title.length > 28 ? title.slice(0, 28) + "…" : title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {plan.unscheduled.length > 0 && (
              <div className="rounded-xl border border-amber/25 bg-amber/[0.05] p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-amber">
                  <AlertTriangle size={12} /> Didn&apos;t fit
                </p>
                <ul className="space-y-1 text-[12px] text-muted">
                  {plan.unscheduled.map((u) => (
                    <li key={u.taskId}>
                      <span className="text-foreground">{u.title}</span>. {u.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.blocks.length > 0 && (
              <button
                onClick={() =>
                  start(async () => {
                    await savePlanAction(plan.day, plan.blocks);
                    setSaved(true);
                    if (plan.day === today) setPlan(null);
                  })
                }
                disabled={pending || saved}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background transition hover:bg-accent hover:text-white disabled:opacity-60"
              >
                <Save size={13} /> {saved ? "Saved" : `Save as ${plan.day === today ? "today's" : "tomorrow's"} plan`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
