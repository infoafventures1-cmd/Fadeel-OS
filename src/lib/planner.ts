import type { TaskRecord, TimetableSlot } from "./task-types";
import { dueInDays, localMinutes, fromHHMM, isoWeekday, toHHMM } from "./time";

export interface DayWindow {
  start: string; // earliest time to schedule work, "HH:MM"
  weekendStart?: string; // Saturday and Sunday
  end: string; // latest
  breakEvery: number; // minutes of continuous focus before a break
  breakMinutes: number;
  /** fixed daily blocks, e.g. dinner */
  routine?: RoutineItem[];
}

export interface RoutineItem {
  start: string;
  end: string;
  title: string;
  /** which days it applies to; default every day */
  days?: "weekdays" | "weekends";
  /** protected time that the planner may only use for work that can't wait (urgent, or due that day / overdue) */
  flexible?: boolean;
}

export interface PlanBlock {
  id: string;
  start: string;
  end: string;
  kind: "fixed" | "task" | "break";
  title: string;
  taskId?: string;
  project?: string;
  priority?: string;
  reason?: string;
  location?: string | null;
  part?: string; // "1/2" when a long task is split
  /** timetable self-study: shown on the timetable but open for planning */
  free?: boolean;
}

export interface PlanResult {
  blocks: PlanBlock[];
  unscheduled: { taskId: string; title: string; reason: string }[];
  freeMinutes: number;
  focusMinutes: number;
}

const PRIORITY_SCORE = { urgent: 100, high: 60, medium: 30, low: 10 } as const;
const DEFAULT_ESTIMATE = 30;
const MIN_CHUNK = 25;
const SESSION_CAP = 90; // tasks not due within 3 days get at most one session a day
const MIN_GAP = 15;

export function scoreTask(t: TaskRecord, today: string) {
  let s: number = PRIORITY_SCORE[t.priority] ?? 30;
  if (t.deadline) {
    const n = dueInDays(t.deadline, today);
    s += n < 0 ? 90 + Math.min(-n, 5) * 5 : n === 0 ? 70 : n === 1 ? 45 : n <= 3 ? 25 : n <= 7 ? 10 : 0;
  }
  if (t.status === "in_progress") s += 5; // finish what's started
  return s;
}

function explain(t: TaskRecord, today: string) {
  const bits: string[] = [t.priority[0].toUpperCase() + t.priority.slice(1)];
  if (t.deadline) {
    const n = dueInDays(t.deadline, today);
    bits.push(n < 0 ? `${-n}d overdue` : n === 0 ? "due today" : n === 1 ? "due tomorrow" : `due in ${n}d`);
  }
  if (!t.estimatedMinutes) bits.push(`~${DEFAULT_ESTIMATE}m guess`);
  return bits.join(" · ");
}

/** Slots that apply to a given weekday (and A/B week when the timetable rotates) */
export function slotsForDay(slots: TimetableSlot[], weekday: number, week: string | null) {
  return slots.filter((s) => s.day === weekday && (!s.week || !week || s.week === week));
}

/**
 * Greedy day planner:
 * 1. timetable slots are fixed;
 * 2. free gaps between them (from now, inside the day window) are the budget;
 * 3. open tasks are ranked by priority + deadline pressure and placed earliest-first,
 *    long tasks are split across gaps, and a short break is inserted after long focus runs.
 */
export function planDay(opts: {
  today: string;
  day: string;
  now?: Date;
  window: DayWindow;
  fixed: TimetableSlot[];
  tasks: TaskRecord[];
  skip?: string[];
}): PlanResult {
  const { today, day, window, fixed, tasks, skip = [] } = opts;
  const isToday = day === today;
  const nowMin = isToday ? Math.ceil(localMinutes(opts.now ?? new Date()) / 5) * 5 : 0;
  const weekend = isoWeekday(day) >= 6;
  const dayStart = Math.max(fromHHMM(weekend ? (window.weekendStart ?? window.start) : window.start), nowMin);
  const dayEnd = fromHHMM(window.end);

  const routine = (window.routine ?? []).filter((r) => !r.days || (r.days === "weekends") === weekend);
  const fixedBlocks: (PlanBlock & { flexible?: boolean })[] = [
    // self-study periods (kind "other") are free time, not commitments
    ...fixed.filter((s) => s.kind !== "other").map((s) => ({ id: `slot-${s.id}`, start: s.starts, end: s.ends, kind: "fixed" as const, title: s.title, location: s.location })),
    ...routine.map((r, i) => ({ id: `routine-${i}`, start: r.start, end: r.end, kind: "fixed" as const, title: r.title, location: null, flexible: r.flexible })),
  ].sort((a, b) => fromHHMM(a.start) - fromHHMM(b.start));

  // free gaps = window minus fixed slots
  const gaps: { start: number; end: number; cursor: number; run: number }[] = [];
  let cur = dayStart;
  for (const f of fixedBlocks) {
    const fs = fromHHMM(f.start);
    const fe = fromHHMM(f.end);
    if (fs - cur >= MIN_GAP) gaps.push({ start: cur, end: Math.min(fs, dayEnd), cursor: cur, run: 0 });
    cur = Math.max(cur, fe);
  }
  if (dayEnd - cur >= MIN_GAP) gaps.push({ start: cur, end: dayEnd, cursor: cur, run: 0 });
  const freeMinutes = gaps.reduce((s, g) => s + Math.max(0, g.end - g.start), 0);

  const candidates = tasks
    .filter((t) => t.status !== "done" && t.status !== "waiting" && !skip.includes(t.id))
    // a task due far in the future only earns time once more pressing work is placed (handled by ordering)
    .map((t) => ({ t, score: scoreTask(t, day) }))
    .sort((a, b) => b.score - a.score);

  const placed: PlanBlock[] = [];
  const unscheduled: PlanResult["unscheduled"] = [];

  const reserve = (g: (typeof gaps)[number], minutes: number) => {
    if (g.run > 0 && g.run + minutes > window.breakEvery && g.end - g.cursor >= window.breakMinutes + minutes) {
      placed.push({ id: `break-${g.cursor}`, start: toHHMM(g.cursor), end: toHHMM(g.cursor + window.breakMinutes), kind: "break", title: "Break" });
      g.cursor += window.breakMinutes;
      g.run = 0;
    }
    const start = g.cursor;
    g.cursor += minutes;
    g.run += minutes;
    return start;
  };

  for (const { t } of candidates) {
    const estimate = t.estimatedMinutes ?? DEFAULT_ESTIMATE;
    const dueSoon = t.deadline ? dueInDays(t.deadline, day) <= 3 : false;
    const need = !dueSoon && estimate > SESSION_CAP ? SESSION_CAP : estimate;
    const latest = t.deadline && t.deadlineHasTime && dueInDays(t.deadline, day) === 0 ? localMinutes(new Date(t.deadline)) : dayEnd;
    const room = (g: (typeof gaps)[number]) => Math.min(g.end, latest) - g.cursor;
    const reason = explain(t, day) + (need < estimate ? ` · ${need} of ${estimate}m today` : "");
    const base = { kind: "task" as const, title: t.title, taskId: t.id, project: t.project, priority: t.priority, reason };

    // long work is done in sessions of at most breakEvery minutes, with breaks between
    const count = Math.ceil(need / window.breakEvery);
    const size = Math.ceil(need / count / 5) * 5;
    const pieces = Array.from({ length: count }, (_, i) => (i < count - 1 ? size : need - size * (count - 1)));

    const chunks: { g: (typeof gaps)[number]; start: number; m: number }[] = [];
    let left = need;
    for (const piece of pieces) {
      const breakCost = (g: (typeof gaps)[number]) => (g.run > 0 && g.run + piece > window.breakEvery ? window.breakMinutes : 0);
      let g = gaps.find((x) => room(x) >= piece + breakCost(x));
      let m = piece;
      if (!g) {
        // nothing fits the whole piece: use the biggest gap that can hold a useful chunk
        g = [...gaps].sort((a, b) => room(b) - room(a)).find((x) => room(x) - breakCost(x) >= MIN_CHUNK);
        if (!g) break;
        m = Math.min(piece, room(g) - breakCost(g));
      }
      chunks.push({ g, start: reserve(g, m), m });
      left -= m;
    }

    chunks.forEach(({ start, m }, i) =>
      placed.push({
        ...base,
        id: `task-${t.id}-${i}`,
        start: toHHMM(start),
        end: toHHMM(start + m),
        part: chunks.length > 1 ? `${i + 1}/${chunks.length}` : undefined,
      })
    );

    if (left > 0) {
      unscheduled.push({
        taskId: t.id,
        title: t.title,
        reason: chunks.length
          ? `Only ${need - left} of ${need}m fit today`
          : latest < dayEnd
            ? "Its deadline passes before there's a free slot long enough"
            : `No free time left today for ${need}m`,
      });
    }
  }

  // Second pass: work that can't wait may spill into flexible routine time (e.g. the rest hour after gym)
  const used = new Set<string>();
  const cantWait = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    return Boolean(t && (t.priority === "urgent" || (t.deadline && dueInDays(t.deadline, day) <= 0)));
  };
  for (const f of fixedBlocks.filter((b) => b.flexible)) {
    let cursor = Math.max(fromHHMM(f.start), dayStart);
    const end = fromHHMM(f.end);
    for (const u of [...unscheduled]) {
      if (end - cursor < MIN_CHUNK || !cantWait(u.taskId)) continue;
      const t = tasks.find((x) => x.id === u.taskId)!;
      const already = placed.filter((b) => b.taskId === t.id).reduce((n, b) => n + fromHHMM(b.end) - fromHHMM(b.start), 0);
      const m = Math.min(end - cursor, Math.max((t.estimatedMinutes ?? DEFAULT_ESTIMATE) - already, MIN_CHUNK));
      placed.push({
        id: `task-${t.id}-flex-${cursor}`,
        start: toHHMM(cursor),
        end: toHHMM(cursor + m),
        kind: "task",
        title: t.title,
        taskId: t.id,
        project: t.project,
        priority: t.priority,
        reason: `${explain(t, day)} · can't wait, so it uses your ${f.title.toLowerCase()} time`,
      });
      cursor += m;
      used.add(f.id);
      unscheduled.splice(unscheduled.indexOf(u), 1);
    }
  }

  const blocks = [...fixedBlocks.filter((b) => !used.has(b.id)), ...placed].sort((a, b) => fromHHMM(a.start) - fromHHMM(b.start));
  const focusMinutes = placed.filter((b) => b.kind === "task").reduce((s, b) => s + fromHHMM(b.end) - fromHHMM(b.start), 0);
  return { blocks, unscheduled, freeMinutes, focusMinutes };
}
