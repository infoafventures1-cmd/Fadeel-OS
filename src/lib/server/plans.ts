import { sql } from "./db";
import { PLAN_SECTIONS, sectionId, type Plan, type PlanChatMsg, type PlanSection } from "@/lib/plan-template";

const isId = (id: string) => /^[0-9a-f-]{36}$/.test(id);

const toPlan = (r: Record<string, unknown>): Plan => ({
  id: String(r.id),
  title: String(r.title),
  idea: String(r.idea ?? ""),
  sections: (r.sections as PlanSection[]) ?? [],
  chat: (r.chat as PlanChatMsg[]) ?? [],
  updatedAt: new Date(r.updated_at as string).toISOString(),
});

export async function listPlans() {
  const rows = await sql`select id, title, idea, sections, updated_at from business_plans order by updated_at desc`;
  return rows.map((r) => {
    const p = toPlan({ ...r, chat: [] });
    return { id: p.id, title: p.title, idea: p.idea, updatedAt: p.updatedAt, filled: p.sections.filter((s) => s.content.trim()).length, total: p.sections.length };
  });
}

export async function getPlan(id: string) {
  if (!isId(id)) return null;
  const [row] = await sql`select * from business_plans where id = ${id}`;
  return row ? toPlan(row) : null;
}

export async function createPlan(title: string, idea: string) {
  const sections: PlanSection[] = PLAN_SECTIONS.map(([t]) => ({ id: sectionId(), title: t, content: "" }));
  const [row] = await sql`insert into business_plans (title, idea, sections) values (${title}, ${idea}, ${JSON.stringify(sections)}::jsonb) returning *`;
  return toPlan(row);
}

export function cleanSections(input: unknown): PlanSection[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 60).map((s) => ({
    id: String(s?.id ?? sectionId()).slice(0, 12),
    title: String(s?.title ?? "Section").slice(0, 120),
    content: String(s?.content ?? "").slice(0, 40_000),
  }));
}

export async function savePlan(id: string, title: string, idea: string, sections: PlanSection[]) {
  if (!isId(id)) return;
  await sql`update business_plans set title = ${title.slice(0, 200) || "Untitled plan"}, idea = ${idea.slice(0, 500)},
    sections = ${JSON.stringify(cleanSections(sections))}::jsonb, updated_at = now() where id = ${id}`;
}

export async function savePlanChat(id: string, chat: PlanChatMsg[]) {
  if (!isId(id)) return;
  await sql`update business_plans set chat = ${JSON.stringify(chat.slice(-60))}::jsonb where id = ${id}`;
}

export async function deletePlan(id: string) {
  if (!isId(id)) return;
  await sql`delete from business_plans where id = ${id}`;
}
