"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
import { PROJECTS } from "@/config";
import { PRIORITIES, type TaskRecord } from "@/lib/task-types";
import { localDate, localMinutes, toHHMM } from "@/lib/time";
import { cn } from "@/lib/utils";
import { parseCapture } from "@/lib/capture";

const field =
  "rounded-lg border border-hairline bg-tint/[0.03] px-2.5 py-1.5 text-[12.5px] text-foreground focus:border-accent/50 focus:outline-none";

export function TaskFields({ task, compact = false, defaultProject }: { task?: TaskRecord; compact?: boolean; defaultProject?: string }) {
  const [status, setStatus] = useState(task?.status ?? "todo");
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
      <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2">
        Project
        <select name="project" defaultValue={task?.project ?? defaultProject ?? "personal"} className={field}>
          {PROJECTS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2">
        Priority
        <select name="priority" defaultValue={task?.priority ?? "medium"} className={field}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2">
        Due date
        <input type="date" name="date" defaultValue={task?.deadline ? localDate(task.deadline) : ""} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2">
        Time (optional)
        <input
          type="time"
          name="time"
          defaultValue={task?.deadline && task.deadlineHasTime ? toHHMM(localMinutes(new Date(task.deadline))) : ""}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2">
        Takes (min)
        <input type="number" name="estimate" min={5} step={5} placeholder="30" defaultValue={task?.estimatedMinutes ?? ""} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2">
        Status
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value as TaskRecord["status"])} className={field}>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="waiting">Waiting on someone</option>
          {task && <option value="done">Done</option>}
        </select>
      </label>
      {status === "waiting" && (
        <label className="col-span-2 flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2">
          Waiting on
          <input name="waitingOn" placeholder="Who?" defaultValue={task?.waitingOn ?? ""} className={field} />
        </label>
      )}
      {!compact && (
        <label className="col-span-2 flex flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2 sm:col-span-3">
          Notes
          <textarea name="notes" rows={2} defaultValue={task?.notes ?? ""} className={cn(field, "resize-y normal-case tracking-normal")} />
        </label>
      )}
    </div>
  );
}

/** Quick-add bar: type and press Enter; open the options for project, priority, due date, estimate */
export function QuickAddTask({
  action,
  placeholder = "Add a task… try “History essay next fri 2pm urgent 90m”",
  project,
}: {
  action: (f: FormData) => Promise<void>;
  placeholder?: string;
  project?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(f) =>
        start(async () => {
          if (!open) {
            // no details given: read project, priority, due date and length out of the sentence
            const c = parseCapture(String(f.get("title") ?? ""));
            f.set("title", c.title);
            f.set("project", project ?? c.project);
            f.set("priority", c.priority);
            if (c.date) f.set("date", c.date);
            if (c.date && c.time) f.set("time", c.time);
            if (c.estimate) f.set("estimate", String(c.estimate));
          }
          if (project && !f.get("project")) f.set("project", project);
          await action(f);
          formRef.current?.reset();
          setOpen(false);
        })
      }
      className="glass rounded-2xl p-2"
    >
      <div className="flex items-center gap-2">
        <Plus size={16} className="ml-2 shrink-0 text-accent" />
        <input
          name="title"
          required
          maxLength={300}
          autoComplete="off"
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-2 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Task options"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition",
            open ? "border-accent/40 text-accent" : "border-hairline text-muted hover:text-foreground"
          )}
        >
          <SlidersHorizontal size={13} /> <span className="hidden sm:inline">Details</span>
        </button>
        <button type="submit" disabled={pending} className="h-8 rounded-lg bg-accent px-3 text-[12px] font-medium text-white transition hover:bg-accent-dim disabled:opacity-60">
          {pending ? "Saving…" : "Add"}
        </button>
      </div>
      {open && (
        <div className="border-t border-hairline px-2 pb-1 pt-3">
          <TaskFields compact defaultProject={project} />
        </div>
      )}
    </form>
  );
}
