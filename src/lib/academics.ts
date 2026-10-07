// Shared by the Academics pages (School, University Applications, Exams, Notes) on the server and in the browser.
import { daysBetween, localDate } from "./time";

export type TopicStatus = "not_started" | "learning" | "needs_practice" | "confident" | "mastered";

/** Weakest first: the order the revision recommendation and the status picker use */
export const TOPIC_STATUSES: { key: TopicStatus; label: string; color: string }[] = [
  { key: "not_started", label: "Not started", color: "var(--muted-2)" },
  { key: "learning", label: "Learning", color: "var(--sky)" },
  { key: "needs_practice", label: "Needs practice", color: "var(--amber)" },
  { key: "confident", label: "Confident", color: "var(--accent-dim)" },
  { key: "mastered", label: "Mastered", color: "var(--emerald)" },
];

export const topicStatus = (key: string) => TOPIC_STATUSES.find((s) => s.key === key) ?? TOPIC_STATUSES[0];
export const isReady = (s: TopicStatus) => s === "confident" || s === "mastered";

export const LEVELS = ["HL", "SL", "Core"] as const;

/** Colours offered for a subject; the dot on its notes uses it */
export const SUBJECT_COLORS = ["#7a5fb0", "#c2334a", "#3b7489", "#2e6b4f", "#a86a00", "#ff5a1f", "#6c6c63"];

export interface Topic {
  id: string;
  subjectId: string;
  title: string;
  status: TopicStatus;
}

export interface Subject {
  id: string;
  name: string;
  level: string;
  color: string;
  currentGrade: string;
  predictedGrade: string;
  nextAssessment: string;
  /** YYYY-MM-DD */
  nextAssessmentDate: string | null;
  topics: Topic[];
}

export type Tier = "safety" | "target" | "reach";
export const TIERS: Tier[] = ["safety", "target", "reach"];

export interface AppStep {
  id: string;
  title: string;
  done: boolean;
}

export interface Application {
  id: string;
  university: string;
  program: string;
  code: string;
  region: string;
  tier: Tier;
  /** YYYY-MM-DD */
  deadline: string | null;
  steps: AppStep[];
  notes: string;
}

/** The checklist a new application starts with. Each one can be renamed, removed or added to on the page. */
export const DEFAULT_STEPS = [
  "Research the programme and requirements",
  "Create the applicant account",
  "Write the personal statement / essays",
  "Ask for references",
  "Send transcripts and predicted grades",
  "Pay the application fee",
  "Submit the application",
];

export interface AcademicNote {
  id: string;
  title: string;
  body: string;
  subjectId: string | null;
  updatedAt: string;
}

export const stepId = () => Math.random().toString(36).slice(2, 10);

/** Days from today to a YYYY-MM-DD; negative = passed */
export const daysUntilDay = (day: string, today = localDate()) => daysBetween(today, day);

/** "Today", "Tomorrow", "5d", "2w", "3mo", "2d ago" */
export function shortUntil(day: string, today = localDate()) {
  const n = daysUntilDay(day, today);
  if (n < 0) return `${-n}d ago`;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 7) return `${n}d`;
  if (n < 60) return `${Math.round(n / 7)}w`;
  return `${Math.round(n / 30)}mo`;
}

/** "15 Oct" */
export const dayMonth = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
