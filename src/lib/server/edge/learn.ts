// Learning features: save, read, takeaways, more/less like this, spaced recall, and the on-demand AI helpers.
import { sql } from "../db";
import { addDays, localDate } from "@/lib/time";
import { connectToSchool, explainSimply } from "./llm";
import { groundParagraph } from "./ground";
import { getEdgeSettings } from "./usage";
import { getBriefing, getItemWithContent, isUuid } from "./store";
import type { BriefingData } from "@/lib/edge";

export const REVIEW_INTERVALS = [1, 7, 30];

export async function setSaved(id: string, saved: boolean) {
  if (!isUuid(id)) return;
  await sql`update edge_items set saved_at = ${saved ? new Date().toISOString() : null} where id = ${id}`;
}

export async function setRead(id: string, read: boolean) {
  if (!isUuid(id)) return;
  await sql`update edge_items set read_at = ${read ? new Date().toISOString() : null} where id = ${id}`;
}

/** Schedule recall reviews about 1, 7 and 30 days out. Re-scheduling the same question doesn't duplicate it. */
export async function scheduleReviews(r: { itemId: string | null; sourceDay: string | null; title: string; question: string; answer: string }) {
  const today = localDate();
  for (const n of REVIEW_INTERVALS) {
    await sql`insert into edge_reviews (item_id, source_day, title, question, answer, interval_days, due)
      values (${r.itemId}, ${r.sourceDay}, ${r.title.slice(0, 200)}, ${r.question.slice(0, 400)}, ${r.answer.slice(0, 1200)}, ${n}, ${addDays(today, n)})
      on conflict do nothing`;
  }
}

/** A takeaway counts as learning: it is saved on the item and scheduled for recall */
export async function saveTakeaway(id: string, text: string) {
  if (!isUuid(id)) return;
  const t = text.trim().slice(0, 1500);
  const [row] = await sql`update edge_items set takeaway = ${t}, takeaway_at = ${t ? new Date().toISOString() : null},
    read_at = coalesce(read_at, ${t ? new Date().toISOString() : null}), saved_at = coalesce(saved_at, ${t ? new Date().toISOString() : null})
    where id = ${id} returning title`;
  if (row && t) await scheduleReviews({ itemId: id, sourceDay: localDate(), title: String(row.title), question: `What was your takeaway from “${String(row.title).slice(0, 120)}”?`, answer: t });
}

/** "I've learned this": the story's or concept's recall question goes into the review schedule */
export async function learnFromBriefing(day: string, kind: "story" | "concept", storyId?: string) {
  const b = await getBriefing(day);
  if (!b) return false;
  if (kind === "concept") {
    const c = b.data.concept;
    if (!c?.recall) return false;
    await scheduleReviews({ itemId: null, sourceDay: day, title: c.title, question: c.recall.q, answer: c.recall.a });
    return true;
  }
  const s = b.data.stories.find((x) => x.id === storyId);
  if (!s?.recall) return false;
  const [row] = await sql`select title from edge_items where id = ${s.itemId}`;
  await scheduleReviews({ itemId: s.itemId, sourceDay: day, title: String(row?.title ?? "Story"), question: s.recall.q, answer: s.recall.a });
  await setRead(s.itemId, true);
  return true;
}

export async function listDueReviews() {
  const rows = await sql`select id, item_id, title, question, answer, interval_days, due::text as due from edge_reviews
    where done_at is null and due <= ${localDate()} order by due, interval_days limit 20`;
  return rows.map((r) => ({ id: String(r.id), itemId: r.item_id ? String(r.item_id) : null, title: String(r.title), question: String(r.question), answer: String(r.answer), interval: Number(r.interval_days), due: String(r.due) }));
}

/** Missed it: ask again tomorrow (the later scheduled reviews stay as they are) */
export async function answerReview(id: string, got: boolean) {
  if (!isUuid(id)) return;
  const [r] = await sql`update edge_reviews set done_at = now(), result = ${got ? "got" : "missed"} where id = ${id} and done_at is null
    returning item_id, source_day::text as source_day, title, question, answer`;
  if (r && !got) {
    await sql`insert into edge_reviews (item_id, source_day, title, question, answer, interval_days, due)
      values (${r.item_id}, ${r.source_day}, ${r.title}, ${r.question}, ${r.answer}, 1, ${addDays(localDate(), 1)}) on conflict do nothing`;
  }
}

export async function addFeedback(id: string, signal: 1 | -1) {
  if (!isUuid(id)) return;
  await sql`insert into edge_feedback (item_id, topic, domain, signal) select id, topic, domain, ${signal} from edge_items where id = ${id}`;
}

/** Explain more simply, from the retrieved evidence only. Cached on the item. */
export async function simpler(id: string, summary: string) {
  const got = await getItemWithContent(id);
  if (!got) return null;
  if (got.item.extras.simple) return got.item.extras.simple;
  const settings = await getEdgeSettings();
  const source = [got.item.title, got.item.snippet, got.content].join("\n\n");
  const raw = await explainSimply(settings.synthModel, got.item.title, source, summary);
  const { text } = groundParagraph(raw, `${source}\n${summary}`);
  const out = text || "There isn't enough retrieved text to explain this more simply without guessing.";
  await sql`update edge_items set extras = extras || ${JSON.stringify({ simple: out })}::jsonb where id = ${id}`;
  return out;
}

/** Connect to IB Economics and Math AI. Cached on the item. */
export async function connect(id: string, summary: string) {
  const got = await getItemWithContent(id);
  if (!got) return null;
  if (got.item.extras.connect) return got.item.extras.connect;
  const settings = await getEdgeSettings();
  const source = [got.item.title, got.item.snippet, got.content].join("\n\n");
  const out = await connectToSchool(settings.synthModel, got.item.title, source, summary);
  await sql`update edge_items set extras = extras || ${JSON.stringify({ connect: out })}::jsonb where id = ${id}`;
  return out;
}

/** Learning History: what was learned (takeaways, recall results), not just what was clicked */
export async function learningHistory() {
  const [takeaways, reviews, upcoming, days] = await Promise.all([
    sql`select id, title, publisher, url, takeaway, takeaway_at from edge_items where takeaway <> '' order by takeaway_at desc limit 50`,
    sql`select count(*) filter (where result = 'got')::int as got, count(*) filter (where result = 'missed')::int as missed from edge_reviews where done_at is not null`,
    sql`select count(*)::int as n from edge_reviews where done_at is null and due > ${localDate()}`,
    sql`select b.day::text as day, b.data,
          (select count(*)::int from edge_items i where i.read_at::date = b.day) as reads,
          (select count(*)::int from edge_items i where i.takeaway_at::date = b.day) as takeaways
        from edge_briefings b order by b.day desc limit 30`,
  ]);
  return {
    takeaways: takeaways.map((r) => ({ id: String(r.id), title: String(r.title), publisher: String(r.publisher), url: String(r.url), takeaway: String(r.takeaway), at: new Date(r.takeaway_at as string).toISOString() })),
    recall: { got: Number(reviews[0]?.got ?? 0), missed: Number(reviews[0]?.missed ?? 0), upcoming: Number(upcoming[0]?.n ?? 0) },
    days: days.map((r) => {
      const data = r.data as BriefingData;
      return { day: String(r.day), stories: data.stories.length, concept: data.concept?.title ?? null, reads: Number(r.reads), takeaways: Number(r.takeaways) };
    }),
  };
}
