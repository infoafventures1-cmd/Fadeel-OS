import type { Priority } from "./types";

export type TaskState = "todo" | "in_progress" | "waiting" | "done";

export interface TaskRecord {
  id: string;
  title: string;
  notes: string | null;
  project: string;
  priority: Priority;
  status: TaskState;
  deadline: string | null; // ISO instant
  deadlineHasTime: boolean;
  estimatedMinutes: number | null;
  waitingOn: string | null;
  link: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AttentionRecord {
  id: string;
  title: string;
  detail: string | null;
  severity: "red" | "orange" | "yellow";
  link: string | null;
  due: string | null; // YYYY-MM-DD
  createdAt: string;
  /** manual = added by hand; auto = derived from tasks */
  kind: "manual" | "auto";
  taskId?: string;
}

export interface TimetableSlot {
  id: string;
  day: number;
  week: string | null;
  starts: string; // HH:MM
  ends: string;
  title: string;
  kind: "class" | "break" | "activity" | "other";
  location: string | null;
  teacher: string | null;
}

export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
