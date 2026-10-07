"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Circle, CheckCircle2, Clock, Hourglass, Trash2, ExternalLink } from "lucide-react";
import type { TaskRecord } from "@/lib/task-types";
import { PriorityBadge } from "@/components/ui/status-pill";
import { projectByKey } from "@/config";
import { dueInDays, formatDue } from "@/lib/time";
import { cn } from "@/lib/utils";
import { deleteTaskAction, toggleTaskAction, updateTaskAction } from "@/app/actions";
import { TaskFields } from "./task-form";

export function TaskItem({ task, editable = true }: { task: TaskRecord; editable?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useOptimistic(task.status === "done");
  const project = projectByKey(task.project);
  const overdue = !done && task.deadline && dueInDays(task.deadline) < 0;

  return (
    <div className={cn("rounded-lg transition", editing ? "bg-tint/[0.04]" : "hover:bg-tint/[0.03]")}>
      <div className="group flex items-center gap-3 px-2 py-2.5">
        <button
          aria-label={done ? "Mark as not done" : "Mark as done"}
          onClick={() =>
            start(async () => {
              setDone(!done);
              await toggleTaskAction(task.id, !done);
            })
          }
          className="shrink-0 text-muted-2 transition hover:text-accent"
        >
          {done ? <CheckCircle2 size={17} className="text-emerald" /> : <Circle size={17} />}
        </button>
        <button onClick={() => editable && setEditing((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className={cn("truncate text-[13.5px]", done ? "text-muted line-through" : "text-foreground")}>{task.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-2">
            {project && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}
            {task.status === "waiting" && (
              <span className="flex items-center gap-1 text-amber">
                <Hourglass size={10} /> Waiting{task.waitingOn ? ` on ${task.waitingOn}` : ""}
              </span>
            )}
            {task.status === "in_progress" && <span className="text-sky">In progress</span>}
          </div>
        </button>
        {task.link && (
          <a href={task.link} target="_blank" rel="noopener" aria-label="Open link" className="text-muted-2 hover:text-accent">
            <ExternalLink size={13} />
          </a>
        )}
        {task.estimatedMinutes && (
          <span className="hidden items-center gap-1 text-[11px] text-muted-2 sm:flex">
            <Clock size={11} />
            {task.estimatedMinutes}m
          </span>
        )}
        <PriorityBadge priority={task.priority} />
        <span className={cn("w-[74px] shrink-0 text-right text-[11.5px] tabular", overdue ? "font-medium text-rose" : "text-muted")}>
          {task.deadline ? formatDue(task.deadline, task.deadlineHasTime) : "—"}
        </span>
      </div>

      {editing && (
        <form
          action={(f) =>
            start(async () => {
              await updateTaskAction(task.id, f);
              setEditing(false);
            })
          }
          className="space-y-3 px-3 pb-3 pl-10"
        >
          <input
            name="title"
            defaultValue={task.title}
            required
            className="w-full rounded-lg border border-hairline bg-tint/[0.03] px-2.5 py-2 text-[13.5px] text-foreground focus:border-accent/50 focus:outline-none"
          />
          <TaskFields task={task} />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete “${task.title}”?`)) start(() => deleteTaskAction(task.id));
              }}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-muted-2 hover:text-rose"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
