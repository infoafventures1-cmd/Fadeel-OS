import { sql } from "./db";
import type { AttentionRecord, TaskRecord, TimetableSlot } from "@/lib/task-types";
import type { PlanBlock, DayWindow } from "@/lib/planner";
import { dueInDays, localDate, formatDue } from "@/lib/time";

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const hhmm = (v: unknown) => String(v).slice(0, 5);

function toTask(r: Row): TaskRecord {
  return {
    id: String(r.id),
    title: String(r.title),
    notes: (r.notes as string) ?? null,
    project: String(r.project),
    priority: r.priority as TaskRecord["priority"],
    status: r.status as TaskRecord["status"],
    deadline: iso(r.deadline),
    deadlineHasTime: Boolean(r.deadline_has_time),
    estimatedMinutes: (r.estimated_minutes as number) ?? null,
    waitingOn: (r.waiting_on as string) ?? null,
    link: (r.link as string) ?? null,
    createdAt: iso(r.created_at)!,
    completedAt: iso(r.completed_at),
  };
}

/* ---------------- tasks ---------------- */

/** Open tasks plus anything completed in the last 14 days */
export async function listTasks(): Promise<TaskRecord[]> {
  const rows = await sql`
    select * from tasks
    where deleted_at is null and (status <> 'done' or completed_at > now() - interval '14 days')
    order by deadline asc nulls last, created_at desc`;
  return rows.map(toTask);
}

export async function listOpenTasks(): Promise<TaskRecord[]> {
  const rows = await sql`select * from tasks where deleted_at is null and status <> 'done' order by deadline asc nulls last, created_at desc`;
  return rows.map(toTask);
}

export interface TaskInput {
  title: string;
  notes?: string | null;
  project?: string;
  priority?: string;
  status?: string;
  deadline?: string | null;
  deadlineHasTime?: boolean;
  estimatedMinutes?: number | null;
  waitingOn?: string | null;
  link?: string | null;
}

export async function createTask(t: TaskInput) {
  const rows = await sql`
    insert into tasks (title, notes, project, priority, status, deadline, deadline_has_time, estimated_minutes, waiting_on, link)
    values (${t.title}, ${t.notes ?? null}, ${t.project ?? "personal"}, ${t.priority ?? "medium"}, ${t.status ?? "todo"},
            ${t.deadline ?? null}, ${t.deadlineHasTime ?? false}, ${t.estimatedMinutes ?? null}, ${t.waitingOn ?? null},
            ${t.link ?? null})
    returning *`;
  return toTask(rows[0]);
}

export async function updateTask(id: string, t: Partial<TaskInput>) {
  const [cur] = await sql`select * from tasks where id = ${id}`;
  if (!cur) throw new Error("Task not found");
  const next = { ...toTask(cur), ...t };
  const status = next.status ?? "todo";
  await sql`
    update tasks set
      title = ${next.title}, notes = ${next.notes ?? null}, project = ${next.project}, priority = ${next.priority},
      status = ${status}, deadline = ${next.deadline ?? null}, deadline_has_time = ${next.deadlineHasTime ?? false},
      estimated_minutes = ${next.estimatedMinutes ?? null}, waiting_on = ${next.waitingOn ?? null},
      completed_at = case when ${status} = 'done' then coalesce(completed_at, now()) else null end,
      updated_at = now()
    where id = ${id}`;
}

export async function setTaskDone(id: string, done: boolean) {
  await sql`
    update tasks set status = ${done ? "done" : "todo"}, completed_at = ${done ? new Date().toISOString() : null}, updated_at = now()
    where id = ${id}`;
}

export async function deleteTask(id: string) {
  await sql`update tasks set deleted_at = now(), updated_at = now() where id = ${id}`;
}

/* ---------------- attention ---------------- */

export async function listManualAttention(): Promise<AttentionRecord[]> {
  const rows = await sql`select * from attention_items where resolved_at is null order by created_at desc`;
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    detail: (r.detail as string) ?? null,
    severity: r.severity as AttentionRecord["severity"],
    link: (r.link as string) ?? null,
    due: r.due ? localDate(iso(r.due)!) : null,
    createdAt: iso(r.created_at)!,
    kind: "manual" as const,
  }));
}

/** Manual items first, then what the task list says needs a look: overdue, due soon and urgent, stale waiting items */
export async function getAttention(): Promise<AttentionRecord[]> {
  const [manual, open] = await Promise.all([listManualAttention(), listOpenTasks()]);
  const today = localDate();
  const auto: AttentionRecord[] = [];
  for (const t of open) {
    const base = { id: `task-${t.id}`, link: "/tasks", due: t.deadline ? localDate(t.deadline) : null, createdAt: t.createdAt, kind: "auto" as const, taskId: t.id };
    if (t.status === "waiting") {
      const days = Math.floor((Date.now() - Date.parse(t.createdAt)) / 86_400_000);
      if (days >= 3) auto.push({ ...base, title: `Chase ${t.waitingOn ?? "a reply"}`, detail: `“${t.title}”, waiting ${days} days`, severity: "yellow" });
      continue;
    }
    if (!t.deadline) {
      if (t.priority === "urgent") auto.push({ ...base, title: "Urgent, no deadline set", detail: t.title, severity: "orange" });
      continue;
    }
    const n = dueInDays(t.deadline, today);
    if (n < 0) auto.push({ ...base, title: `Overdue · ${formatDue(t.deadline, false, today)}`, detail: t.title, severity: "red" });
    else if (n === 0) auto.push({ ...base, title: "Due today", detail: t.title, severity: t.priority === "low" ? "yellow" : "red" });
    else if (n === 1 && t.priority !== "low") auto.push({ ...base, title: "Due tomorrow", detail: t.title, severity: "orange" });
    else if (n <= 3 && (t.priority === "urgent" || t.priority === "high")) auto.push({ ...base, title: `Due in ${n} days`, detail: t.title, severity: "yellow" });
  }
  const rank = { red: 0, orange: 1, yellow: 2 };
  auto.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return [...manual, ...auto];
}

export async function addAttention(a: { title: string; detail?: string | null; severity?: string; link?: string | null; due?: string | null }) {
  await sql`insert into attention_items (title, detail, severity, link, due)
            values (${a.title}, ${a.detail ?? null}, ${a.severity ?? "orange"}, ${a.link ?? null}, ${a.due ?? null})`;
}

export async function resolveAttention(id: string) {
  await sql`update attention_items set resolved_at = now() where id = ${id}`;
}

/* ---------------- timetable, plans, settings ---------------- */

export async function listTimetable(): Promise<TimetableSlot[]> {
  const rows = await sql`select * from timetable_slots order by day, starts`;
  return rows.map((r) => ({
    id: String(r.id),
    day: Number(r.day),
    week: (r.week as string) ?? null,
    starts: hhmm(r.starts),
    ends: hhmm(r.ends),
    title: String(r.title),
    kind: r.kind as TimetableSlot["kind"],
    location: (r.location as string) ?? null,
    teacher: (r.teacher as string) ?? null,
  }));
}

export async function addTimetableSlot(s: Omit<TimetableSlot, "id">) {
  await sql`insert into timetable_slots (day, week, starts, ends, title, kind, location, teacher)
            values (${s.day}, ${s.week}, ${s.starts}, ${s.ends}, ${s.title}, ${s.kind}, ${s.location}, ${s.teacher})`;
}

export async function deleteTimetableSlot(id: string) {
  await sql`delete from timetable_slots where id = ${id}`;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await sql`select value from settings where key = ${key}`;
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await sql`insert into settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)
            on conflict (key) do update set value = excluded.value`;
}

export const DEFAULT_WINDOW: DayWindow = {
  start: "07:00",
  weekendStart: "09:00",
  end: "22:00",
  breakEvery: 90,
  breakMinutes: 10,
  routine: [{ start: "19:00", end: "20:00", title: "Dinner" }],
};

export async function getDayPlan(day: string): Promise<PlanBlock[] | null> {
  const [row] = await sql`select blocks from day_plans where day = ${day}`;
  return row ? (row.blocks as PlanBlock[]) : null;
}

export async function saveDayPlan(day: string, blocks: PlanBlock[]) {
  await sql`insert into day_plans (day, blocks) values (${day}, ${JSON.stringify(blocks)}::jsonb)
            on conflict (day) do update set blocks = excluded.blocks, created_at = now()`;
}

export async function clearDayPlan(day: string) {
  await sql`delete from day_plans where day = ${day}`;
}
