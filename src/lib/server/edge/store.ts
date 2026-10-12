// Reads and writes for Daily Edge items, briefings and weekly syntheses.
import { sql } from "../db";
import type { Access, BriefingData, EdgeItem, SourceType, TopicKey, WeeklyData } from "@/lib/edge";

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
export const isUuid = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id);

const ACCESS_RANK: Record<Access, number> = { headline: 0, paywalled: 1, video: 1, excerpt: 2, full: 3 };

export function toItem(r: Row): EdgeItem {
  const meta = (r.meta as Record<string, unknown>) ?? {};
  return {
    id: String(r.id),
    url: String(r.url),
    title: String(r.title),
    publisher: String(r.publisher ?? ""),
    domain: String(r.domain ?? ""),
    kind: (r.kind as EdgeItem["kind"]) ?? "article",
    topic: (r.topic as TopicKey) ?? null,
    sourceType: r.source_type as SourceType,
    access: r.access as Access,
    publishedAt: iso(r.published_at),
    eventDate: (r.event_day as string) ?? null,
    retrievedAt: iso(r.retrieved_at),
    snippet: String(r.snippet ?? ""),
    words: Number(r.words ?? 0),
    evergreen: Boolean(r.evergreen),
    channel: (meta.channel as string) ?? undefined,
    durationMin: (meta.durationMin as number) ?? null,
    thumbnail: (meta.thumbnail as string) ?? null,
    savedAt: iso(r.saved_at),
    readAt: iso(r.read_at),
    takeaway: String(r.takeaway ?? ""),
    extras: (r.extras as EdgeItem["extras"]) ?? {},
  };
}

export interface ItemUpsert {
  canonical: string;
  url: string;
  title: string;
  publisher: string;
  domain: string;
  kind: "article" | "video";
  sourceId: string;
  topic: TopicKey | null;
  sourceType: SourceType;
  access: Access;
  publishedAt: string | null;
  retrievedAt: string | null;
  snippet: string;
  content: string;
  words: number;
  evergreen: boolean;
  cluster: string | null;
  score: number;
  meta: Record<string, unknown>;
}

/**
 * Insert or update by canonical URL, so a rerun never creates a second copy. Retrieval only ever upgrades
 * (a later headline-only pass never overwrites full text), and the owner's saved/read/takeaway fields are never touched.
 */
export async function upsertItem(i: ItemUpsert): Promise<string> {
  const [cur] = await sql`select id, access from edge_items where canonical_url = ${i.canonical}`;
  if (cur) {
    const upgrade = ACCESS_RANK[i.access] > ACCESS_RANK[cur.access as Access];
    await sql`update edge_items set
        title = ${i.title}, publisher = ${i.publisher}, topic = coalesce(${i.topic}, topic), source_type = ${i.sourceType},
        published_at = coalesce(published_at, ${i.publishedAt}), retrieved_at = coalesce(${i.retrievedAt}, retrieved_at),
        snippet = case when length(${i.snippet}) > length(snippet) then ${i.snippet} else snippet end,
        access = case when ${upgrade} then ${i.access} else access end,
        content = case when ${upgrade} then ${i.content} else content end,
        words = case when ${upgrade} then ${i.words} else words end,
        evergreen = ${i.evergreen}, cluster = coalesce(${i.cluster}, cluster), score = ${i.score},
        meta = meta || ${JSON.stringify(i.meta)}::jsonb, updated_at = now()
      where id = ${cur.id}`;
    return String(cur.id);
  }
  const [row] = await sql`insert into edge_items (canonical_url, url, title, publisher, domain, kind, source_id, topic, source_type, access,
      published_at, retrieved_at, snippet, content, words, evergreen, cluster, score, meta)
    values (${i.canonical}, ${i.url}, ${i.title}, ${i.publisher}, ${i.domain}, ${i.kind}, ${i.sourceId}, ${i.topic}, ${i.sourceType}, ${i.access},
      ${i.publishedAt}, ${i.retrievedAt}, ${i.snippet}, ${i.content}, ${i.words}, ${i.evergreen}, ${i.cluster}, ${i.score}, ${JSON.stringify(i.meta)}::jsonb)
    on conflict (canonical_url) do update set updated_at = now()
    returning id`;
  return String(row.id);
}

export async function setEventDate(id: string, day: string | null) {
  await sql`update edge_items set event_date = ${day} where id = ${id}`;
}

export async function getItems(ids: string[]): Promise<EdgeItem[]> {
  const clean = ids.filter(isUuid);
  if (!clean.length) return [];
  const rows = await sql`select *, event_date::text as event_day from edge_items where id = any(${clean}::uuid[])`;
  return rows.map(toItem);
}

export async function getItemWithContent(id: string) {
  if (!isUuid(id)) return null;
  const [r] = await sql`select *, event_date::text as event_day from edge_items where id = ${id}`;
  return r ? { item: toItem(r), content: String(r.content ?? "") } : null;
}

/** Explore: recent items, best first. evergreen=true lists the older foundational material instead. */
export async function listExplore(opts: { topic?: string | null; evergreen?: boolean; limit?: number }) {
  const topic = opts.topic && opts.topic !== "all" ? opts.topic : null;
  const rows = opts.evergreen
    ? await sql`select *, event_date::text as event_day from edge_items
        where (evergreen or published_at < now() - interval '7 days') and (${topic}::text is null or topic = ${topic})
        order by score desc, published_at desc nulls last limit ${opts.limit ?? 40}`
    : await sql`select *, event_date::text as event_day from edge_items
        where not evergreen and (published_at >= now() - interval '7 days' or (published_at is null and created_at >= now() - interval '7 days'))
          and (${topic}::text is null or topic = ${topic})
        order by date_trunc('day', coalesce(published_at, created_at)) desc, score desc limit ${opts.limit ?? 60}`;
  return rows.map(toItem);
}

export async function listSaved() {
  const rows = await sql`select *, event_date::text as event_day from edge_items where saved_at is not null order by saved_at desc limit 200`;
  return rows.map(toItem);
}

export async function getBriefing(day?: string): Promise<{ day: string; data: BriefingData } | null> {
  const [row] = day
    ? await sql`select day::text as d, data from edge_briefings where day = ${day}`
    : await sql`select day::text as d, data from edge_briefings order by day desc limit 1`;
  return row ? { day: String(row.d), data: row.data as BriefingData } : null;
}

export async function saveBriefing(day: string, jobId: string, data: BriefingData) {
  await sql`insert into edge_briefings (day, job_id, data) values (${day}, ${jobId}, ${JSON.stringify(data)}::jsonb)
    on conflict (day) do update set data = excluded.data, job_id = excluded.job_id, created_at = now()`;
}

export async function listBriefingDays(limit = 30) {
  const rows = await sql`select day::text as d, data from edge_briefings order by day desc limit ${limit}`;
  return rows.map((r) => ({ day: String(r.d), data: r.data as BriefingData }));
}

/** Canonical URLs and event keys already used as stories on earlier days (to avoid repeating yesterday's news) */
export async function recentlyFeatured(beforeDay: string, days = 7) {
  const rows = await sql`select data from edge_briefings where day < ${beforeDay} and day >= ${beforeDay}::date - ${days}::int`;
  const itemIds = new Set<string>();
  const events = new Set<string>();
  for (const r of rows) {
    for (const s of (r.data as BriefingData).stories ?? []) {
      itemIds.add(s.itemId);
      s.corroboratingIds.forEach((x) => itemIds.add(x));
      s.syndicatedIds.forEach((x) => itemIds.add(x));
      if (s.event) events.add(s.event);
    }
  }
  const titles = itemIds.size ? (await sql`select title from edge_items where id = any(${[...itemIds]}::uuid[])`).map((r) => String(r.title)) : [];
  return { itemIds, events, titles };
}

export async function getWeekly(weekStart: string) {
  const [row] = await sql`select data from edge_weekly where week_start = ${weekStart}`;
  return row ? (row.data as WeeklyData) : null;
}

export async function latestWeekly() {
  const [row] = await sql`select week_start::text as w, data from edge_weekly order by week_start desc limit 1`;
  return row ? { weekStart: String(row.w), data: row.data as WeeklyData } : null;
}

export async function saveWeekly(weekStart: string, data: WeeklyData) {
  await sql`insert into edge_weekly (week_start, data) values (${weekStart}, ${JSON.stringify(data)}::jsonb)
    on conflict (week_start) do update set data = excluded.data, created_at = now()`;
}

/** Feedback per topic and domain: + more like this, - less like this */
export async function feedbackWeights() {
  const rows = await sql`select topic, domain, sum(signal)::int as s from edge_feedback where created_at > now() - interval '90 days' group by topic, domain`;
  const topic = new Map<string, number>();
  const domain = new Map<string, number>();
  for (const r of rows) {
    if (r.topic) topic.set(String(r.topic), (topic.get(String(r.topic)) ?? 0) + Number(r.s));
    if (r.domain) domain.set(String(r.domain), (domain.get(String(r.domain)) ?? 0) + Number(r.s));
  }
  return { topic, domain };
}
