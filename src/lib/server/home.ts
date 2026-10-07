import { getAttention, getDayPlan, getSetting, listTasks, listTimetable, DEFAULT_WINDOW } from "./data";
import { WEATHER } from "@/config";
import { planDay, scoreTask, slotsForDay, type DayWindow, type PlanBlock } from "@/lib/planner";
import { TZ, dueInDays, localDate, localMinutes, fromHHMM, isoWeekday, toHHMM } from "@/lib/time";

export interface Weather {
  temp: number;
  label: string;
  city: string;
}

const WMO: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Fog",
  51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

/** Current weather for the city in src/config.ts, from Open-Meteo (free, no key), cached 30 min */
export async function getWeather(): Promise<Weather | null> {
  if (!WEATHER) return null;
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER.latitude}&longitude=${WEATHER.longitude}&current=temperature_2m,weather_code&timezone=${encodeURIComponent(TZ)}`,
      { next: { revalidate: 1800 } }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { current?: { temperature_2m: number; weather_code: number } };
    if (!j.current) return null;
    return { temp: Math.round(j.current.temperature_2m), label: WMO[j.current.weather_code] ?? "—", city: WEATHER.city };
  } catch {
    return null;
  }
}

/** Today's timeline: the saved plan if there is one, otherwise just the timetable */
export async function getTodayTimeline(day = localDate()) {
  const [saved, slots, week] = await Promise.all([getDayPlan(day), listTimetable(), getSetting<string | null>("timetable_week", null)]);
  const fixed = slotsForDay(slots, isoWeekday(day), week);
  const blocks: PlanBlock[] =
    saved ??
    fixed.map((s) => ({ id: `slot-${s.id}`, start: s.starts, end: s.ends, kind: "fixed" as const, title: s.title, location: s.location, free: s.kind === "other" }));
  return { blocks, planned: Boolean(saved), classes: fixed.filter((s) => s.kind === "class").length, hasTimetable: slots.length > 0 };
}

export async function getHomeData() {
  const today = localDate();
  const [tasks, attention, timeline, window] = await Promise.all([
    listTasks(),
    getAttention(),
    getTodayTimeline(today),
    getSetting<DayWindow>("day_window", DEFAULT_WINDOW),
  ]);
  const open = tasks.filter((t) => t.status !== "done");
  const active = open.filter((t) => t.status !== "waiting");
  const dueToday = active.filter((t) => t.deadline && dueInDays(t.deadline, today) === 0);
  const overdue = active.filter((t) => t.deadline && dueInDays(t.deadline, today) < 0);
  const waiting = open.filter((t) => t.status === "waiting");
  const top = [...active].sort((a, b) => scoreTask(b, today) - scoreTask(a, today))[0];
  const weekAgo = Date.now() - 7 * 86_400_000;
  const doneThisWeek = tasks.filter((t) => t.completedAt && Date.parse(t.completedAt) > weekAgo).length;

  // free time left today, from the same gap logic the planner uses
  const free = planDay({ today, day: today, window, fixed: timeline.blocks.filter((b) => b.kind === "fixed" && !b.free && !b.id.startsWith("routine-")).map((b) => ({ id: b.id, day: 0, week: null, starts: b.start, ends: b.end, title: b.title, kind: "class" as const, location: null, teacher: null })), tasks: [] }).freeMinutes;

  const nowMin = localMinutes();
  const next = timeline.blocks.find((b) => fromHHMM(b.start) > nowMin);

  const brief: string[] = [];
  if (timeline.hasTimetable) brief.push(timeline.classes ? `${timeline.classes} class${timeline.classes > 1 ? "es" : ""} on your timetable today.` : "Nothing on your timetable today.");
  if (overdue.length) brief.push(`${overdue.length} task${overdue.length > 1 ? "s are" : " is"} overdue.`);
  brief.push(dueToday.length ? `${dueToday.length} task${dueToday.length > 1 ? "s" : ""} due today.` : "Nothing is due today.");
  if (top) brief.push(`Most pressing: “${top.title}”.`);
  if (waiting.length) brief.push(`Waiting on others for ${waiting.length} thing${waiting.length > 1 ? "s" : ""}.`);
  brief.push(
    timeline.planned
      ? `Today is planned: ${timeline.blocks.filter((b) => b.kind === "task").length} focus blocks.`
      : `${Math.floor(free / 60)}h ${free % 60}m of free time left today, and no plan yet.`
  );

  return {
    today,
    attention,
    brief,
    timeline,
    next: next ? { title: next.title, start: next.start } : null,
    stats: {
      open: active.length,
      urgent: active.filter((t) => t.priority === "urgent" || t.priority === "high").length,
      overdue: overdue.length,
      waiting: waiting.length,
      doneThisWeek,
      freeToday: free,
    },
    byProject: Object.entries(
      open.reduce<Record<string, { open: number; next?: { title: string; deadline: string } }>>((acc, t) => {
        const p = (acc[t.project] ??= { open: 0 });
        p.open++;
        if (t.deadline && (!p.next || t.deadline < p.next.deadline)) p.next = { title: t.title, deadline: t.deadline };
        return acc;
      }, {})
    ),
    nowLabel: toHHMM(nowMin),
  };
}

export type HomeData = Awaited<ReturnType<typeof getHomeData>>;
