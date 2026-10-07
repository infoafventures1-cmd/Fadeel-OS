import { PROJECTS } from "@/config";
import type { Priority } from "./types";
import { addDays, localDate, isoWeekday } from "./time";

// Plain-English task parsing shared by Quick Capture and the Tasks quick-add:
// "History essay next fri 2pm urgent 90m" → project, priority, due date/time, estimate, clean title.

/** First project (in src/config.ts order) whose keywords appear in the text */
export function detectProject(...texts: string[]) {
  for (const t of texts) {
    const lower = t.toLowerCase();
    for (const p of PROJECTS) if (p.keywords?.test(lower)) return p.key;
  }
  return "personal";
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_RE = "(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(?:day|sday|nesday|rsday|urday)?";
const MONTH_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
const LEAD = "(?:\\b(?:due|by|on|before|until|till)\\s+)?";

export interface Captured {
  title: string;
  project: string;
  priority: Priority;
  /** how the priority was decided, for the UI */
  priorityWhy: string | null;
  date: string | null; // YYYY-MM-DD, local
  time: string | null; // HH:MM
  estimate: number | null; // minutes
}

export function parseCapture(input: string, today = localDate()): Captured {
  let text = ` ${input} `;
  const take = (re: RegExp) => {
    const m = text.match(re);
    if (m) text = text.replace(m[0], " ");
    return m;
  };

  /* ---- priority: explicit words win, otherwise inferred later ---- */
  let priority: Priority | null = null;
  let priorityWhy: string | null = null;
  if (take(/\b(urgent(ly)?|asap|critical|emergency|top priority|p1)\b|!!!/i)) [priority, priorityWhy] = ["urgent", "you said so"];
  else if (take(/\b(high priority|important|high prio|priority|p2)\b|!!/i)) [priority, priorityWhy] = ["high", "you said so"];
  else if (take(/\b(low priority|low prio|whenever|someday|no rush|not urgent|eventually|p4)\b/i)) [priority, priorityWhy] = ["low", "you said so"];
  else if (take(/\b(medium priority|normal priority|p3)\b/i)) [priority, priorityWhy] = ["medium", "you said so"];

  /* ---- estimate: 30m, 45 min, 2h, 1.5 hours, 1h30 ---- */
  let estimate: number | null = null;
  // 1h30 / 1h 30m (minutes need to be glued on or carry an "m", so "2h 5 oct" stays a date)
  const hm = take(/\b(?:for |takes? |~)?(\d+)\s*h(?:ours?|rs?)?(?:(\d{2})\b|\s*(\d{1,2})\s*(?:minutes?|mins?|m)\b)/i);
  if (hm) estimate = Number(hm[1]) * 60 + Number(hm[2] ?? hm[3]);
  else {
    const h = take(/\b(?:for |takes? |~)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
    const m = h ? null : take(/\b(?:for |takes? |~)?(\d{1,3})\s*(?:minutes?|mins?|m)\b/i);
    if (h) estimate = Math.round(parseFloat(h[1]) * 60);
    else if (m) estimate = Number(m[1]);
  }

  /* ---- time: at 5pm, 5:30pm, 17:30, by 6 ---- */
  let time: string | null = null;
  const t12 = take(/\b(?:at|by|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (t12) {
    let h = Number(t12[1]) % 12;
    if (t12[3].toLowerCase() === "pm") h += 12;
    time = `${String(h).padStart(2, "0")}:${t12[2] ?? "00"}`;
  } else {
    const t24 = take(/\b(?:at|by|@)?\s*([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (t24) time = `${t24[1].padStart(2, "0")}:${t24[2]}`;
    else {
      const noon = take(/\b(?:at|by)\s+(noon|midnight)\b/i);
      if (noon) time = noon[1].toLowerCase() === "noon" ? "12:00" : "23:59";
    }
  }

  /* ---- date ---- */
  let date: string | null = null;
  const wd = isoWeekday(today);
  const year = Number(today.slice(0, 4));
  const iso = (y: number, mo: number, d: number) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const future = (mo: number, d: number) => (iso(year, mo, d) < today ? iso(year + 1, mo, d) : iso(year, mo, d));
  let m: RegExpMatchArray | null;

  if (take(new RegExp(`${LEAD}\\b(today|tonight|this evening|eod|end of day)\\b`, "i"))) date = today;
  else if (take(new RegExp(`${LEAD}\\b(day after tomorrow)\\b`, "i"))) date = addDays(today, 2);
  else if (take(new RegExp(`${LEAD}\\b(tomorrow|tmrw|tmr|tom)\\b`, "i"))) date = addDays(today, 1);
  else if ((m = take(/\bin\s+(\d+|a|an|one|two|three)\s+(day|week|month)s?\b/i))) {
    const n = { a: 1, an: 1, one: 1, two: 2, three: 3 }[m[1].toLowerCase()] ?? Number(m[1]);
    date = addDays(today, n * (m[2].toLowerCase() === "day" ? 1 : m[2].toLowerCase() === "week" ? 7 : 30));
  } else if ((m = take(new RegExp(`${LEAD}\\bnext\\s+${DAY_RE}\\b`, "i")))) {
    // "next friday" = the friday of next week
    const target = DAYS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    date = addDays(today, 7 - wd + target);
  } else if (take(new RegExp(`${LEAD}\\b(next week)\\b`, "i"))) date = addDays(today, 8 - wd);
  else if (take(new RegExp(`${LEAD}\\b(this weekend|the weekend|weekend)\\b`, "i"))) date = addDays(today, wd >= 6 ? 0 : 6 - wd);
  else if (take(new RegExp(`${LEAD}\\b(end of (the )?week|eow)\\b`, "i"))) date = addDays(today, wd > 5 ? 0 : 5 - wd);
  else if (take(new RegExp(`${LEAD}\\b(end of (the )?month|eom)\\b`, "i"))) {
    const [y, mo] = today.split("-").map(Number);
    date = iso(y, mo, new Date(Date.UTC(y, mo, 0)).getUTCDate());
  } else if ((m = take(new RegExp(`${LEAD}\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, "i")))) {
    date = future(MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, Number(m[1]));
  } else if ((m = take(new RegExp(`${LEAD}\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i")))) {
    date = future(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, Number(m[2]));
  } else if ((m = take(new RegExp(`${LEAD}\\b(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?\\b`)))) {
    // day/month order
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) date = m[3] ? iso(Number(m[3].length === 2 ? `20${m[3]}` : m[3]), mo, d) : future(mo, d);
  } else if ((m = take(new RegExp(`${LEAD}\\b(?:this\\s+|on\\s+)?${DAY_RE}\\b`, "i")))) {
    // a bare weekday = the next one coming (today counts as next week)
    const target = DAYS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    date = addDays(today, (target - wd + 7) % 7 || 7);
  } else if ((m = take(new RegExp(`\\b(?:due|by|on)\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)\\b`, "i")))) {
    // "by the 14th" = this month, or next if it has passed
    const [y, mo] = today.split("-").map(Number);
    const d = Number(m[1]);
    date = iso(y, mo, d) >= today ? iso(y, mo, d) : mo === 12 ? iso(y + 1, 1, d) : iso(y, mo + 1, d);
  }
  if (time && !date) date = today;

  /* ---- inferred priority ---- */
  const lower = input.toLowerCase();
  if (!priority) {
    const days = date ? Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) : null;
    const graded = /\b(exam|test|quiz|oral|summative|assessment|exhibition|deadline|submission|submit|final|ia|ee|mock|interview|presentation|paper [123])\b/.test(lower);
    const errand = detectProject(input) === "personal"; // everyday things due today aren't automatically high priority
    if (days !== null && days <= 1 && graded) [priority, priorityWhy] = ["urgent", "graded work due within a day"];
    else if (days !== null && days <= 1 && !errand) [priority, priorityWhy] = ["high", days <= 0 ? "due today" : "due tomorrow"];
    else if (graded) [priority, priorityWhy] = ["high", "exam / deadline wording"];
    else if (days !== null && days <= 3 && !errand) [priority, priorityWhy] = ["high", `due in ${days} days`];
    else priority = "medium";
  }

  const title = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/^[\s,.;:\-–]+|[\s,;:\-–]+$/g, "")
    .replace(/\b(due|by|on|at|before|for)$/i, "")
    .trim();

  return {
    title: title ? title[0].toUpperCase() + title.slice(1) : input.trim(),
    project: detectProject(input),
    priority,
    priorityWhy,
    date,
    time,
    estimate,
  };
}
