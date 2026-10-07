import { sql } from "./db";
import {
  DEFAULT_STEPS,
  LEVELS,
  TIERS,
  TOPIC_STATUSES,
  stepId,
  type AcademicNote,
  type AppStep,
  type Application,
  type Subject,
  type Tier,
  type Topic,
  type TopicStatus,
} from "@/lib/academics";

type Row = Record<string, unknown>;
const isId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id);
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/* ---------------- subjects and topics ---------------- */

export async function listSubjects(): Promise<Subject[]> {
  const [subjects, topics] = await Promise.all([
    sql`select *, next_assessment_date::text as next_date from subjects order by sort, created_at`,
    sql`select * from subject_topics order by created_at`,
  ]);
  return subjects.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    level: String(r.level),
    color: String(r.color),
    currentGrade: String(r.current_grade ?? ""),
    predictedGrade: String(r.predicted_grade ?? ""),
    nextAssessment: String(r.next_assessment ?? ""),
    nextAssessmentDate: (r.next_date as string) ?? null,
    topics: topics
      .filter((t: Row) => String(t.subject_id) === String(r.id))
      .map((t: Row): Topic => ({ id: String(t.id), subjectId: String(t.subject_id), title: String(t.title), status: t.status as TopicStatus })),
  }));
}

export interface SubjectInput {
  name?: string;
  level?: string;
  color?: string;
  currentGrade?: string;
  predictedGrade?: string;
  nextAssessment?: string;
  nextAssessmentDate?: string | null;
}

const cleanLevel = (l: unknown) => (LEVELS.includes(l as never) ? String(l) : "SL");
const cleanColor = (c: unknown) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : "#7a5fb0");

export async function createSubject(s: SubjectInput) {
  const name = text(s.name, 80);
  if (!name) return null;
  const [row] = await sql`insert into subjects (name, level, color, sort)
    values (${name}, ${cleanLevel(s.level)}, ${cleanColor(s.color)}, (select coalesce(max(sort), 0) + 1 from subjects))
    returning id`;
  return String(row.id);
}

export async function updateSubject(id: string, s: SubjectInput) {
  if (!isId(id)) return;
  const [cur] = await sql`select *, next_assessment_date::text as next_date from subjects where id = ${id}`;
  if (!cur) return;
  const name = s.name === undefined ? String(cur.name) : text(s.name, 80) || String(cur.name);
  const level = s.level === undefined ? String(cur.level) : cleanLevel(s.level);
  const color = s.color === undefined ? String(cur.color) : cleanColor(s.color);
  const current = s.currentGrade === undefined ? String(cur.current_grade) : text(s.currentGrade, 12);
  const predicted = s.predictedGrade === undefined ? String(cur.predicted_grade) : text(s.predictedGrade, 12);
  const next = s.nextAssessment === undefined ? String(cur.next_assessment) : text(s.nextAssessment, 120);
  const date = s.nextAssessmentDate === undefined ? ((cur.next_date as string) ?? null) : isDay(s.nextAssessmentDate) ? s.nextAssessmentDate : null;
  await sql`update subjects set name = ${name}, level = ${level}, color = ${color}, current_grade = ${current},
    predicted_grade = ${predicted}, next_assessment = ${next}, next_assessment_date = ${date} where id = ${id}`;
}

export async function deleteSubject(id: string) {
  if (!isId(id)) return;
  await sql`delete from subjects where id = ${id}`;
}

export async function addTopic(subjectId: string, title: string) {
  const t = text(title, 160);
  if (!isId(subjectId) || !t) return;
  await sql`insert into subject_topics (subject_id, title) values (${subjectId}, ${t})`;
}

export async function setTopicStatus(id: string, status: string) {
  if (!isId(id) || !TOPIC_STATUSES.some((s) => s.key === status)) return;
  await sql`update subject_topics set status = ${status} where id = ${id}`;
}

export async function deleteTopic(id: string) {
  if (!isId(id)) return;
  await sql`delete from subject_topics where id = ${id}`;
}

/* ---------------- university applications ---------------- */

function cleanSteps(input: unknown): AppStep[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 40)
    .map((s) => ({ id: text(s?.id, 12) || stepId(), title: text(s?.title, 160), done: Boolean(s?.done) }))
    .filter((s) => s.title);
}

const toApplication = (r: Row): Application => ({
  id: String(r.id),
  university: String(r.university),
  program: String(r.program ?? ""),
  code: String(r.code ?? ""),
  region: String(r.region ?? "Other"),
  tier: r.tier as Tier,
  deadline: (r.deadline_day as string) ?? null,
  steps: cleanSteps(r.steps),
  notes: String(r.notes ?? ""),
});

/** Soonest deadline first, undated ones last */
export async function listApplications(): Promise<Application[]> {
  const rows = await sql`select *, deadline::text as deadline_day from uni_applications order by deadline asc nulls last, created_at`;
  return rows.map(toApplication);
}

export interface ApplicationInput {
  university?: string;
  program?: string;
  code?: string;
  region?: string;
  tier?: string;
  deadline?: string | null;
  steps?: AppStep[];
  notes?: string;
}

const cleanTier = (t: unknown): Tier => (TIERS.includes(t as Tier) ? (t as Tier) : "target");

export async function createApplication(a: ApplicationInput) {
  const university = text(a.university, 120);
  if (!university) return;
  const steps = DEFAULT_STEPS.map((title) => ({ id: stepId(), title, done: false }));
  await sql`insert into uni_applications (university, program, code, region, tier, deadline, steps)
    values (${university}, ${text(a.program, 200)}, ${text(a.code, 40)}, ${text(a.region, 40) || "Other"}, ${cleanTier(a.tier)},
            ${isDay(a.deadline) ? a.deadline : null}, ${JSON.stringify(steps)}::jsonb)`;
}

export async function updateApplication(id: string, a: ApplicationInput) {
  if (!isId(id)) return;
  const [cur] = await sql`select *, deadline::text as deadline_day from uni_applications where id = ${id}`;
  if (!cur) return;
  const c = toApplication(cur);
  const next = {
    university: a.university === undefined ? c.university : text(a.university, 120) || c.university,
    program: a.program === undefined ? c.program : text(a.program, 200),
    code: a.code === undefined ? c.code : text(a.code, 40),
    region: a.region === undefined ? c.region : text(a.region, 40) || "Other",
    tier: a.tier === undefined ? c.tier : cleanTier(a.tier),
    deadline: a.deadline === undefined ? c.deadline : isDay(a.deadline) ? a.deadline : null,
    steps: a.steps === undefined ? c.steps : cleanSteps(a.steps),
    notes: a.notes === undefined ? c.notes : String(a.notes).slice(0, 20_000),
  };
  await sql`update uni_applications set university = ${next.university}, program = ${next.program}, code = ${next.code},
    region = ${next.region}, tier = ${next.tier}, deadline = ${next.deadline}, steps = ${JSON.stringify(next.steps)}::jsonb,
    notes = ${next.notes}, updated_at = now() where id = ${id}`;
}

export async function deleteApplication(id: string) {
  if (!isId(id)) return;
  await sql`delete from uni_applications where id = ${id}`;
}

/* ---------------- notes ---------------- */

export async function listNotes(): Promise<AcademicNote[]> {
  const rows = await sql`select * from academic_notes order by updated_at desc`;
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    body: String(r.body ?? ""),
    subjectId: r.subject_id ? String(r.subject_id) : null,
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }));
}

export async function createNote(n: { title?: string; body?: string; subjectId?: string | null }) {
  const title = text(n.title, 160) || "Untitled note";
  await sql`insert into academic_notes (title, body, subject_id)
    values (${title}, ${String(n.body ?? "").slice(0, 40_000)}, ${isId(n.subjectId) ? n.subjectId : null})`;
}

export async function updateNote(id: string, n: { title?: string; body?: string; subjectId?: string | null }) {
  if (!isId(id)) return;
  await sql`update academic_notes set title = ${text(n.title, 160) || "Untitled note"}, body = ${String(n.body ?? "").slice(0, 40_000)},
    subject_id = ${isId(n.subjectId) ? n.subjectId : null}, updated_at = now() where id = ${id}`;
}

export async function deleteNote(id: string) {
  if (!isId(id)) return;
  await sql`delete from academic_notes where id = ${id}`;
}
