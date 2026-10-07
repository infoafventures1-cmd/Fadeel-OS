"use client";

import { useTransition } from "react";
import { CheckCircle2, Circle, Coffee, MapPin } from "lucide-react";
import type { PlanBlock } from "@/lib/planner";
import { localMinutes, fromHHMM } from "@/lib/time";
import { projectByKey } from "@/config";
import { toggleTaskAction } from "@/app/actions";
import { cn } from "@/lib/utils";

export function DayTimeline({ blocks, doneIds = [], isToday = true }: { blocks: PlanBlock[]; doneIds?: string[]; isToday?: boolean }) {
  const [, start] = useTransition();
  const now = localMinutes();
  if (blocks.length === 0) return <p className="py-6 text-center text-[13px] text-muted">Nothing scheduled.</p>;

  return (
    <ol className="relative space-y-1.5 border-l border-hairline pl-5">
      {blocks.map((b) => {
        const s = fromHHMM(b.start);
        const e = fromHHMM(b.end);
        const live = isToday && s <= now && now < e;
        const past = isToday && e <= now;
        const done = b.taskId ? doneIds.includes(b.taskId) : false;
        const project = b.project ? projectByKey(b.project) : undefined;
        return (
          <li key={b.id} className={cn("relative", past && !live && "opacity-50")}>
            <span
              className={cn(
                "absolute -left-[25px] top-3.5 h-2 w-2 rounded-full ring-4 ring-background",
                live ? "bg-accent" : b.kind === "fixed" ? "bg-sky" : b.kind === "break" ? "bg-muted-2" : "bg-foreground/60"
              )}
            />
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                b.kind === "fixed" && !b.free && "border-sky/25 bg-sky/[0.06]",
                b.free && "border-dashed border-hairline",
                b.kind === "task" && "border-hairline bg-tint/[0.02]",
                b.kind === "break" && "border-transparent py-1.5",
                live && "border-accent/50 bg-accent/10"
              )}
            >
              <span className="w-[92px] shrink-0 font-mono text-[11px] tabular text-muted-2">
                {b.start}–{b.end}
              </span>
              {b.kind === "break" ? (
                <span className="flex items-center gap-1.5 text-[12px] text-muted-2">
                  <Coffee size={12} /> Break
                </span>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13.5px]", done ? "text-muted line-through" : "text-foreground")}>
                    {b.title}
                    {b.part && <span className="ml-1.5 text-[11px] text-muted-2">part {b.part}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-2">
                    {b.kind === "fixed" && !b.free && <span className="text-sky">Timetable</span>}
                    {b.free && <span>Free for tasks</span>}
                    {b.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={10} /> {b.location}
                      </span>
                    )}
                    {project && <span>{project.name}</span>}
                    {b.reason && <span>· {b.reason}</span>}
                  </p>
                </div>
              )}
              {live && <span className="font-mono text-[10px] uppercase tracking-wider text-accent">Now</span>}
              {b.taskId && (
                <button
                  aria-label={done ? "Mark not done" : "Mark done"}
                  onClick={() => start(() => toggleTaskAction(b.taskId!, !done))}
                  className="text-muted-2 hover:text-accent"
                >
                  {done ? <CheckCircle2 size={16} className="text-emerald" /> : <Circle size={16} />}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
