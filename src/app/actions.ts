"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/server/auth";
import * as data from "@/lib/server/data";
import { planDay, slotsForDay, type DayWindow, type PlanBlock, type PlanResult } from "@/lib/planner";
import { localDate, localToISO, isoWeekday } from "@/lib/time";
import { PRIORITIES } from "@/lib/task-types";

const refresh = () => {
  revalidatePath("/", "layout");
};

const clean = (v: FormDataEntryValue | null | undefined) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
};

function parseTaskForm(form: FormData) {
  const date = clean(form.get("date"));
  const time = clean(form.get("time"));
  const est = Number(clean(form.get("estimate")) ?? NaN);
  const priority = clean(form.get("priority")) ?? "medium";
  const status = clean(form.get("status")) ?? "todo";
  return {
    title: (clean(form.get("title")) ?? "").slice(0, 300),
    notes: clean(form.get("notes")),
    project: clean(form.get("project")) ?? "personal",
    priority: PRIORITIES.includes(priority as never) ? priority : "medium",
    status: ["todo", "in_progress", "waiting", "done"].includes(status) ? status : "todo",
    deadline: date ? localToISO(date, time ?? "23:59") : null,
    deadlineHasTime: Boolean(date && time),
    estimatedMinutes: Number.isFinite(est) && est > 0 ? Math.round(est) : null,
    waitingOn: clean(form.get("waitingOn")),
    link: clean(form.get("link")),
  };
}

/* ---------------- tasks ---------------- */

export async function createTaskAction(form: FormData) {
  await requireSession();
  const t = parseTaskForm(form);
  if (!t.title) return;
  await data.createTask(t);
  refresh();
}

export async function updateTaskAction(id: string, form: FormData) {
  await requireSession();
  const t = parseTaskForm(form);
  if (!t.title) return;
  await data.updateTask(id, t);
  refresh();
}

export async function toggleTaskAction(id: string, done: boolean) {
  await requireSession();
  await data.setTaskDone(id, done);
  refresh();
}

export async function deleteTaskAction(id: string) {
  await requireSession();
  await data.deleteTask(id);
  refresh();
}

/* ---------------- attention ---------------- */

export async function addAttentionAction(form: FormData) {
  await requireSession();
  const title = clean(form.get("title"));
  if (!title) return;
  const severity = clean(form.get("severity")) ?? "orange";
  await data.addAttention({
    title: title.slice(0, 200),
    detail: clean(form.get("detail")),
    severity: ["red", "orange", "yellow"].includes(severity) ? severity : "orange",
    due: clean(form.get("due")),
    link: clean(form.get("link")),
  });
  refresh();
}

export async function resolveAttentionAction(id: string) {
  await requireSession();
  await data.resolveAttention(id);
  refresh();
}

/** Turn an attention item into a task (and clear it from the list) */
export async function attentionToTaskAction(id: string, title: string, due: string | null) {
  await requireSession();
  await data.createTask({ title, deadline: due ? localToISO(due) : null, priority: "high" });
  await data.resolveAttention(id);
  refresh();
}

/* ---------------- plan my day ---------------- */

export async function generatePlanAction(day: string, skip: string[] = []): Promise<PlanResult & { day: string; window: DayWindow }> {
  await requireSession();
  const [tasks, slots, window, week] = await Promise.all([
    data.listOpenTasks(),
    data.listTimetable(),
    data.getSetting<DayWindow>("day_window", data.DEFAULT_WINDOW),
    data.getSetting<string | null>("timetable_week", null),
  ]);
  const result = planDay({
    today: localDate(),
    day,
    window,
    fixed: slotsForDay(slots, isoWeekday(day), week),
    tasks,
    skip,
  });
  return { ...result, day, window };
}

export async function savePlanAction(day: string, blocks: PlanBlock[]) {
  await requireSession();
  await data.saveDayPlan(day, blocks);
  refresh();
}

export async function clearPlanAction(day: string) {
  await requireSession();
  await data.clearDayPlan(day);
  refresh();
}

export async function saveDayWindowAction(window: DayWindow) {
  await requireSession();
  const ok = /^\d{2}:\d{2}$/;
  if (!ok.test(window.start) || !ok.test(window.end)) return;
  const routine = (window.routine ?? [])
    .filter((r) => ok.test(r.start) && ok.test(r.end) && r.start < r.end && r.title?.trim())
    .slice(0, 12)
    .map((r) => ({
      start: r.start,
      end: r.end,
      title: r.title.trim().slice(0, 60),
      ...(r.days === "weekdays" || r.days === "weekends" ? { days: r.days } : {}),
      ...(r.flexible ? { flexible: true } : {}),
    }));
  await data.setSetting("day_window", {
    start: window.start,
    weekendStart: window.weekendStart && ok.test(window.weekendStart) ? window.weekendStart : window.start,
    end: window.end,
    breakEvery: Math.min(Math.max(Number(window.breakEvery) || 90, 30), 240),
    breakMinutes: Math.min(Math.max(Number(window.breakMinutes) || 10, 5), 30),
    routine,
  });
}

/* ---------------- documents ---------------- */

export async function createDocAction() {
  await requireSession();
  const { createDoc } = await import("@/lib/server/docs");
  const { redirect } = await import("next/navigation");
  const doc = await createDoc();
  redirect(`/docs/${doc.id}`);
}

export async function saveDocAction(id: string, title: string, content: string) {
  await requireSession();
  const { saveDoc } = await import("@/lib/server/docs");
  await saveDoc(id, title, content);
}

export async function deleteDocAction(id: string) {
  await requireSession();
  const { deleteDoc } = await import("@/lib/server/docs");
  const { redirect } = await import("next/navigation");
  await deleteDoc(id);
  refresh();
  redirect("/docs");
}

/* ---------------- university business plans ---------------- */

export async function createPlanAction(form: FormData) {
  await requireSession();
  const { createPlan } = await import("@/lib/server/plans");
  const { redirect } = await import("next/navigation");
  const title = (clean(form.get("title")) ?? "Untitled plan").slice(0, 200);
  const idea = (clean(form.get("idea")) ?? "").slice(0, 500);
  const plan = await createPlan(title, idea);
  refresh();
  redirect(`/plans/${plan.id}`);
}

export async function saveBusinessPlanAction(id: string, title: string, idea: string, sections: { id: string; title: string; content: string }[]) {
  await requireSession();
  const { savePlan } = await import("@/lib/server/plans");
  await savePlan(id, title, idea, sections);
}

export async function deletePlanAction(id: string) {
  await requireSession();
  const { deletePlan } = await import("@/lib/server/plans");
  const { redirect } = await import("next/navigation");
  await deletePlan(id);
  refresh();
  redirect("/plans");
}

/* ---------------- timetable ---------------- */

export async function addTimetableSlotAction(form: FormData) {
  await requireSession();
  const ok = /^\d{2}:\d{2}$/;
  const day = Number(form.get("day"));
  const starts = clean(form.get("starts")) ?? "";
  const ends = clean(form.get("ends")) ?? "";
  const title = clean(form.get("title"));
  const kind = clean(form.get("kind")) ?? "class";
  if (!title || !(day >= 1 && day <= 7) || !ok.test(starts) || !ok.test(ends) || starts >= ends) return;
  await data.addTimetableSlot({
    day,
    week: null,
    starts,
    ends,
    title: title.slice(0, 80),
    kind: (["class", "break", "activity", "other"].includes(kind) ? kind : "class") as "class",
    location: clean(form.get("location"))?.slice(0, 80) ?? null,
    teacher: null,
  });
  refresh();
}

export async function deleteTimetableSlotAction(id: string) {
  await requireSession();
  await data.deleteTimetableSlot(id);
  refresh();
}
