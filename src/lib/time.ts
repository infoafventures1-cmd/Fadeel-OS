import { TIMEZONE } from "@/config";

// Everything date-related is computed on the owner's clock (TIMEZONE in src/config.ts),
// because the server runs in UTC.
export const TZ = TIMEZONE;

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const offsetFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" });

/** Minutes TZ is ahead of UTC at a given instant (follows daylight saving where there is any) */
function offsetMinutes(d: Date) {
  const name = offsetFmt.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** "YYYY-MM-DD" of an instant, local time */
export function localDate(d: Date | string = new Date()) {
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}

/** Minutes since local midnight */
export function localMinutes(d: Date = new Date()) {
  const m = Math.floor(d.getTime() / 60000) + offsetMinutes(d);
  return ((m % 1440) + 1440) % 1440;
}

/** ISO weekday of a "YYYY-MM-DD" (1 = Monday … 7 = Sunday) */
export function isoWeekday(day: string) {
  const w = new Date(`${day}T12:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Whole days from today until the deadline's local date; negative = overdue */
export function dueInDays(deadline: string, today = localDate()) {
  return daysBetween(today, localDate(deadline));
}

/** Local wall-clock date + "HH:MM" → ISO instant */
export function localToISO(day: string, hhmm = "23:59") {
  const wall = Date.parse(`${day}T${hhmm}:00Z`);
  // the offset at the wall time read as UTC is right except within hours of a clock change, so look again at the result
  const first = wall - offsetMinutes(new Date(wall)) * 60000;
  return new Date(wall - offsetMinutes(new Date(first)) * 60000).toISOString();
}

/** Label for a "YYYY-MM-DD" (weekday, day of month…) that never drifts with the viewer's own timezone */
export function formatDay(day: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
}

export const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const fromHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function formatDue(deadline: string, hasTime: boolean, today = localDate()) {
  const n = dueInDays(deadline, today);
  const time = hasTime ? ` ${toHHMM(localMinutes(new Date(deadline)))}` : "";
  if (n < 0) return `${-n}d overdue`;
  if (n === 0) return `Today${time}`;
  if (n === 1) return `Tomorrow${time}`;
  if (n < 7) return new Date(deadline).toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ }) + time;
  return new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
}
