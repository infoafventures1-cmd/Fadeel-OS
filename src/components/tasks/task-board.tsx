"use client";

import { useMemo, useState } from "react";
import type { TaskRecord } from "@/lib/task-types";
import { PROJECTS } from "@/config";
import { dueInDays, localDate } from "@/lib/time";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { createTaskAction } from "@/app/actions";
import { QuickAddTask } from "./task-form";
import { TaskItem } from "./task-item";

const VIEWS = ["Focus", "Today", "Upcoming", "Overdue", "No date", "Waiting", "All open", "Done"] as const;
type View = (typeof VIEWS)[number];

const HINTS: Record<View, string> = {
  Focus: "Overdue, due today, and anything urgent",
  Today: "Due today",
  Upcoming: "Due in the next 14 days",
  Overdue: "Past their due date",
  "No date": "Open tasks with no due date",
  Waiting: "Waiting on someone else",
  "All open": "Everything not done",
  Done: "Finished in the last 14 days",
};

const RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

function inView(t: TaskRecord, view: View, today: string) {
  if (view === "Done") return t.status === "done";
  if (t.status === "done") return false;
  if (view === "Waiting") return t.status === "waiting";
  if (view === "All open") return true;
  if (t.status === "waiting") return false;
  const n = t.deadline ? dueInDays(t.deadline, today) : null;
  switch (view) {
    case "Focus":
      return (n !== null && n <= 0) || t.priority === "urgent";
    case "Today":
      return n === 0;
    case "Upcoming":
      return n !== null && n > 0 && n <= 14;
    case "Overdue":
      return n !== null && n < 0;
    case "No date":
      return n === null;
  }
}

export function TaskBoard({ tasks }: { tasks: TaskRecord[] }) {
  const [view, setView] = useState<View>("Focus");
  const [project, setProject] = useState("all");
  const today = localDate();

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v, tasks.filter((t) => inView(t, v, today)).length])), [tasks, today]);

  const shown = useMemo(() => {
    const items = tasks.filter((t) => inView(t, view, today) && (project === "all" || t.project === project));
    if (view === "Done") return items.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return items.sort((a, b) => {
      const da = a.deadline ? Date.parse(a.deadline) : Infinity;
      const db = b.deadline ? Date.parse(b.deadline) : Infinity;
      return da - db || RANK[a.priority] - RANK[b.priority];
    });
  }, [tasks, view, project, today]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-semibold leading-none">
            Everything on your <em>plate</em>.
          </h1>
          <p className="mt-2 text-[12.5px] text-muted">
            {counts["All open"]} open · {counts.Overdue} overdue · {counts.Done} done in the last 14 days
          </p>
        </div>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="rounded-lg border border-hairline bg-tint/[0.03] px-2.5 py-1.5 text-[12px] text-foreground focus:outline-none"
        >
          <option value="all">All projects</option>
          {PROJECTS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <QuickAddTask action={createTaskAction} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition",
              view === v ? "border-accent/40 bg-accent/15 text-accent" : "border-hairline bg-tint/[0.02] text-muted hover:text-foreground"
            )}
          >
            {v} <span className="tabular text-muted-2">{counts[v]}</span>
          </button>
        ))}
      </div>
      <p className="mb-3 text-[12px] text-muted-2">{HINTS[view]}</p>

      <GlassCard hover={false} className="p-2">
        {shown.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-muted">
            {tasks.length === 0 ? "No tasks yet. Add one above, or press C anywhere to capture one." : "Nothing here."}
          </p>
        ) : (
          shown.map((t) => <TaskItem key={t.id} task={t} />)
        )}
      </GlassCard>
    </div>
  );
}
