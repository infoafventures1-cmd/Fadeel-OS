// Ranking and deduplication. Pure functions (no I/O) so they can be tested on their own.
import { TOPICS, type EdgeSettings, type SourceType, type TopicKey } from "@/lib/edge";

export interface Rankable {
  title: string;
  snippet: string;
  domain: string;
  publishedAt: string | null;
  sourceType: SourceType;
  topicHint: TopicKey | null;
  kind: "article" | "video";
}

const STOP = new Set("a an the and or of to in on for with by at from as is are was were be its it this that new says said after over into about than more how why what will can could amid up out".split(" "));

export const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9%$.-]+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));

export function jaccard(a: string[], b: string[]) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

/** Keyword relevance per topic (0..1) */
export function topicScores(text: string) {
  const t = ` ${text.toLowerCase()} `;
  const out = {} as Record<TopicKey, number>;
  for (const topic of TOPICS) {
    let hits = 0;
    for (const k of topic.keywords) if (t.includes(` ${k}`) || t.includes(`${k} `)) hits++;
    out[topic.key] = Math.min(hits, 4) / 4;
  }
  return out;
}

export function bestTopic(r: Rankable): { topic: TopicKey; relevance: number } {
  const s = topicScores(`${r.title} ${r.snippet}`);
  if (r.topicHint) s[r.topicHint] = Math.max(s[r.topicHint], 0.5);
  let best: TopicKey = r.topicHint ?? "ai_finance";
  for (const k of Object.keys(s) as TopicKey[]) if (s[k] > s[best]) best = k;
  // AI × finance needs both halves: "AI" alone or "bank" alone is a weaker match
  if (best === "ai_finance") {
    const t = `${r.title} ${r.snippet}`.toLowerCase();
    const ai = /\b(ai|artificial intelligence|machine learning|llm|generative|agentic|model)\b/.test(t);
    const fin = /\b(bank|banking|payment|lending|loan|credit|fraud|fintech|insur|trading|financ)/.test(t);
    if (!(ai && fin)) s.ai_finance *= 0.5;
  }
  return { topic: best, relevance: s[best] };
}

const QUALITY: Record<SourceType, number> = { official: 1, filing: 1, research: 0.95, news: 0.75, preliminary: 0.7, company: 0.55, commentary: 0.6, video: 0.6 };
const WIRE = /(^|\.)(reuters\.com|bloomberg\.com|ft\.com|apnews\.com)$/;

export function evidenceQuality(r: Pick<Rankable, "sourceType" | "domain">) {
  return Math.min(1, QUALITY[r.sourceType] + (r.sourceType === "news" && WIRE.test(r.domain) ? 0.15 : 0));
}

/** 1 within 48 hours, falling to 0.4 at 7 days; older items belong in Evergreen learning instead */
export function freshness(publishedAt: string | null, now = Date.now()) {
  if (!publishedAt) return 0.35;
  const h = (now - Date.parse(publishedAt)) / 3_600_000;
  if (h <= 48) return 1;
  if (h <= 168) return 1 - ((h - 48) / 120) * 0.6;
  return 0.15;
}

export const isEvergreen = (r: Pick<Rankable, "publishedAt" | "sourceType">, now = Date.now()) =>
  r.publishedAt !== null && now - Date.parse(r.publishedAt) > 7 * 86_400_000;

/**
 * Score = relevance (weighted by the owner's topic weights) + evidence quality + freshness + learning value
 * + more/less-like-this feedback. Popularity is not an input.
 */
export function score(
  r: Rankable,
  settings: EdgeSettings,
  extra: { learning?: number; relevance?: number; topic?: TopicKey; feedbackTopic?: number; feedbackDomain?: number } = {},
  now = Date.now()
) {
  const bt = bestTopic(r);
  const topic = extra.topic ?? bt.topic;
  const rel = extra.relevance ?? bt.relevance;
  const total = Object.values(settings.weights).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const w = Math.max(0, settings.weights[topic]) / total; // 0..1
  const weighted = rel * (0.5 + w * 2); // a 40% topic gets about 1.3x, a 15% topic about 0.8x
  const fb = Math.max(-3, Math.min(3, (extra.feedbackTopic ?? 0) * 0.5 + (extra.feedbackDomain ?? 0))) * 0.05;
  return 0.35 * weighted + 0.25 * evidenceQuality(r) + 0.2 * freshness(r.publishedAt, now) + 0.2 * (extra.learning ?? 0.5) + fb;
}

/* ---------------- deduplication ---------------- */

export interface Clusterable {
  key: string; // canonical url
  title: string;
  snippet: string;
  domain: string;
  publishedAt: string | null;
  event?: string | null;
}

/**
 * Group candidates that report the same underlying event. Same canonical URL is always one item;
 * a shared event key (from triage) or very similar headlines within 72 hours put items in one cluster.
 */
export function cluster<T extends Clusterable>(items: T[]): T[][] {
  const unique = new Map<string, T>();
  for (const i of items) if (!unique.has(i.key)) unique.set(i.key, i);
  const list = [...unique.values()];
  const tok = list.map((i) => tokens(i.title));
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const ea = list[a].event, eb = list[b].event;
      const sameEvent = Boolean(ea && eb && ea === eb);
      const close = !list[a].publishedAt || !list[b].publishedAt || Math.abs(Date.parse(list[a].publishedAt!) - Date.parse(list[b].publishedAt!)) < 72 * 3_600_000;
      if (sameEvent || (close && jaccard(tok[a], tok[b]) >= 0.5)) parent[find(a)] = find(b);
    }
  }
  const groups = new Map<number, T[]>();
  list.forEach((i, idx) => {
    const r = find(idx);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });
  return [...groups.values()];
}

/**
 * Within one event: which reports are independent, and which are copies of the same text (syndication).
 * A copy has a near-identical headline and summary to an earlier item from another site; it does not count as corroboration.
 */
export function splitSyndicated<T extends Clusterable>(group: T[]): { independent: T[]; syndicated: T[] } {
  const sorted = [...group].sort((a, b) => (WIRE.test(b.domain) ? 1 : 0) - (WIRE.test(a.domain) ? 1 : 0) || (Date.parse(a.publishedAt ?? "") || 0) - (Date.parse(b.publishedAt ?? "") || 0));
  const independent: T[] = [];
  const syndicated: T[] = [];
  const seenDomains = new Set<string>();
  for (const i of sorted) {
    const copy = independent.some((o) => jaccard(tokens(o.title), tokens(i.title)) >= 0.8 && (jaccard(tokens(o.snippet), tokens(i.snippet)) >= 0.6 || !i.snippet));
    if (copy || seenDomains.has(i.domain)) syndicated.push(i);
    else {
      independent.push(i);
      seenDomains.add(i.domain);
    }
  }
  return { independent, syndicated };
}
