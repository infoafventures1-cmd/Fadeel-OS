// Discovery: turn sources into candidate items (title, link, date, snippet). Nothing here reads full articles.
import { TOPICS, type EdgeSettings, type SourceType, type TopicKey } from "@/lib/edge";
import { canonicalUrl, domainOf, getJson, getText, FetchError, toIso } from "./net";
import { parseFeed } from "./parse";
import { PUBLISHERS, recordSourceStatus, sourceTypeForDomain, type SourceRow } from "./sources";
import { sql } from "../db";

export interface Candidate {
  url: string;
  canonical: string;
  title: string;
  publisher: string;
  domain: string;
  publishedAt: string | null;
  snippet: string;
  sourceId: string;
  sourceType: SourceType;
  topicHint: TopicKey | null;
  kind: "article" | "video";
  video?: { id: string; channel: string; thumbnail?: string; durationMin?: number | null };
  via: "rss" | "search" | "youtube";
}

export interface SourceResult {
  sourceId: string;
  name: string;
  ok: boolean;
  items: number;
  error?: string;
}

const env = (k: string) => (process.env[k] ?? "").trim();
export const hasSearchKey = () => Boolean(env("BRAVE_SEARCH_API_KEY"));
export const hasYouTubeKey = () => Boolean(env("YOUTUBE_API_KEY"));

const DAY = 86_400_000;
const withinDays = (iso: string | null, days: number) => !iso || Date.now() - Date.parse(iso) <= days * DAY;

const publisherFor = (domain: string, fallback = "") => PUBLISHERS[domain] ?? PUBLISHERS[domain.split(".").slice(-2).join(".")] ?? fallback ?? domain;

/* ---------------- RSS ---------------- */

export async function fromRss(s: SourceRow): Promise<{ items: Candidate[]; result: SourceResult }> {
  const window = s.meta?.window ?? 7;
  try {
    const r = await getText(s.url!);
    if (r.status >= 400) throw new FetchError(`HTTP ${r.status}`, r.status);
    const feed = parseFeed(r.text);
    if (!feed) throw new FetchError("Not an RSS or Atom feed");
    const items = feed.entries
      .filter((e) => withinDays(e.publishedAt, window))
      .map<Candidate>((e) => {
        const domain = domainOf(e.url);
        return {
          url: e.url,
          canonical: canonicalUrl(e.url),
          title: e.title,
          publisher: publisherFor(domain, s.name),
          domain,
          publishedAt: e.publishedAt,
          snippet: e.summary.slice(0, 600),
          sourceId: s.id,
          sourceType: sourceTypeForDomain(domain, s.sourceType),
          topicHint: s.topic ?? null,
          kind: "article",
          via: "rss",
        };
      });
    await recordSourceStatus(s.id, true, feed.entries.length, null, true);
    return { items, result: { sourceId: s.id, name: s.name, ok: true, items: items.length } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    await recordSourceStatus(s.id, false, null, msg);
    return { items: [], result: { sourceId: s.id, name: s.name, ok: false, items: 0, error: msg } };
  }
}

/* ---------------- web search (Brave Search API) ---------------- */

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  page_age?: string;
  age?: string;
  meta_url?: { hostname?: string };
}

/** One query. news=true uses the news index; freshness pd/pw/pm = past day/week/month. */
export async function braveSearch(q: string, opts: { news: boolean; freshness: "pd" | "pw" | "pm"; count?: number }) {
  const base = opts.news ? "https://api.search.brave.com/res/v1/news/search" : "https://api.search.brave.com/res/v1/web/search";
  const url = `${base}?q=${encodeURIComponent(q)}&count=${opts.count ?? 10}&freshness=${opts.freshness}&search_lang=en&safesearch=moderate`;
  const { status, json } = await getJson<{ results?: BraveResult[]; web?: { results?: BraveResult[] } }>(url, {
    headers: { "X-Subscription-Token": env("BRAVE_SEARCH_API_KEY") },
  });
  if (status === 401 || status === 403) throw new FetchError("Brave Search rejected the API key", status);
  if (status === 402) throw new FetchError("Brave Search account is out of credit", status);
  if (status >= 400 || !json) throw new FetchError(`Brave Search HTTP ${status}`, status);
  return (opts.news ? json.results : json.web?.results) ?? [];
}

/** Queries for this run: topic queries split by weight, plus site-targeted queries for search-only sources */
export function planQueries(settings: EdgeSettings, searchSources: SourceRow[]) {
  const max = Math.max(0, settings.maxSearchQueries);
  const plan: { q: string; news: boolean; freshness: "pd" | "pw" | "pm"; sourceId: string; topic: TopicKey | null }[] = [];
  // site-targeted: one per enabled search source, combined with its main topic's words
  const siteBudget = Math.min(searchSources.length, Math.ceil(max / 2));
  const topicsByWeight = [...TOPICS].sort((a, b) => settings.weights[b.key] - settings.weights[a.key]);
  searchSources.slice(0, siteBudget).forEach((s, i) => {
    const t = s.topic ? TOPICS.find((x) => x.key === s.topic)! : topicsByWeight[i % topicsByWeight.length];
    const research = s.sourceType === "research" || s.sourceType === "official" || s.sourceType === "filing";
    plan.push({ q: `site:${s.site} ${t.queries[0]}`, news: !research, freshness: research ? "pm" : "pw", sourceId: s.id, topic: s.topic ?? null });
  });
  // the rest: topic queries in proportion to weight
  const left = max - plan.length;
  const total = TOPICS.reduce((n, t) => n + Math.max(0, settings.weights[t.key]), 0) || 1;
  const quota = TOPICS.map((t) => ({ t, n: Math.round((left * Math.max(0, settings.weights[t.key])) / total) }));
  for (const { t, n } of quota) for (let i = 0; i < n && i < t.queries.length; i++) plan.push({ q: t.queries[i], news: true, freshness: "pd", sourceId: "search", topic: t.key });
  return plan.slice(0, max);
}

export async function fromSearch(plan: ReturnType<typeof planQueries>, onQuery: () => Promise<void>): Promise<{ items: Candidate[]; results: SourceResult[]; queries: number }> {
  const items: Candidate[] = [];
  const results = new Map<string, SourceResult>();
  let queries = 0;
  for (const p of plan) {
    try {
      await onQuery();
      queries++;
      const rows = await braveSearch(p.q, { news: p.news, freshness: p.freshness });
      for (const r of rows) {
        if (!r.url || !r.title) continue;
        const domain = domainOf(r.url);
        items.push({
          url: r.url,
          canonical: canonicalUrl(r.url),
          title: r.title.replace(/<[^>]+>/g, ""),
          publisher: publisherFor(domain, r.meta_url?.hostname ?? domain),
          domain,
          publishedAt: toIso(r.page_age),
          snippet: (r.description ?? "").replace(/<[^>]+>/g, "").slice(0, 600),
          sourceId: p.sourceId,
          sourceType: sourceTypeForDomain(domain, "news"),
          topicHint: p.topic,
          kind: "article",
          via: "search",
        });
      }
      const prev = results.get(p.sourceId) ?? { sourceId: p.sourceId, name: p.sourceId, ok: true, items: 0 };
      results.set(p.sourceId, { ...prev, items: prev.items + rows.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      results.set(p.sourceId, { sourceId: p.sourceId, name: p.sourceId, ok: false, items: 0, error: msg });
      if (e instanceof FetchError && (e.status === 401 || e.status === 402 || e.status === 403)) break; // key problem: stop spending attempts
      if (e instanceof Error && /cap/i.test(e.message)) break;
    }
  }
  for (const r of results.values()) if (r.sourceId !== "search") await recordSourceStatus(r.sourceId, r.ok, r.items, r.error ?? null, r.ok);
  return { items, results: [...results.values()], queries };
}

/* ---------------- YouTube ---------------- */

/** Resolve a handle to its channel id with the YouTube Data API (channels.list, forHandle). Stored once found. */
export async function resolveChannel(s: SourceRow): Promise<string | null> {
  if (!hasYouTubeKey() || !s.meta?.handle) return s.meta?.channelId ?? null;
  const { json } = await getJson<{ items?: { id: string; snippet?: { title?: string } }[] }>(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(s.meta.handle)}&key=${env("YOUTUBE_API_KEY")}`
  );
  const hit = json?.items?.[0];
  if (!hit?.id) return s.meta?.channelId ?? null;
  await sql`update edge_sources set meta = meta || ${JSON.stringify({ channelId: hit.id, resolvedAt: new Date().toISOString(), resolvedTitle: hit.snippet?.title ?? "" })}::jsonb where id = ${s.id}`;
  return hit.id;
}

/** ISO 8601 duration (PT1H2M3S) → minutes */
const isoMinutes = (d: string) => {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Math.round(Number(m[3] ?? 0) / 60) : null;
};

export async function fromYouTube(s: SourceRow): Promise<{ items: Candidate[]; result: SourceResult }> {
  try {
    const channelId = await resolveChannel(s);
    if (!channelId) throw new FetchError("Channel id not resolved yet: add YOUTUBE_API_KEY to look it up from the handle");
    const r = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    if (r.status >= 400) throw new FetchError(`HTTP ${r.status}`, r.status);
    const feed = parseFeed(r.text);
    if (!feed) throw new FetchError("Not a channel feed");
    // verified only when the live feed is the channel we expect
    const expect = (s.meta?.expectName ?? s.name).toLowerCase().replace(/\s+/g, "");
    const matches = feed.title.toLowerCase().replace(/\s+/g, "").includes(expect);
    if (!matches) throw new FetchError(`Feed title "${feed.title}" does not match ${s.meta?.expectName ?? s.name}`);
    let items = feed.entries
      .filter((e) => e.videoId && withinDays(e.publishedAt, 30))
      .map<Candidate>((e) => ({
        url: `https://www.youtube.com/watch?v=${e.videoId}`,
        canonical: canonicalUrl(`https://www.youtube.com/watch?v=${e.videoId}`),
        title: e.title,
        publisher: feed.title || s.name,
        domain: "youtube.com",
        publishedAt: e.publishedAt,
        snippet: e.summary.slice(0, 1200),
        sourceId: s.id,
        sourceType: "video",
        topicHint: s.topic ?? null,
        kind: "video",
        video: { id: e.videoId!, channel: feed.title || s.name, thumbnail: e.thumbnail },
        via: "youtube",
      }));
    // durations (and full descriptions) when a Data API key is set: videos.list, 1 quota unit per call
    if (hasYouTubeKey() && items.length) {
      const ids = items.map((i) => i.video!.id).slice(0, 50).join(",");
      const { json } = await getJson<{ items?: { id: string; contentDetails?: { duration?: string }; snippet?: { description?: string } }[] }>(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${ids}&key=${env("YOUTUBE_API_KEY")}`
      );
      const byId = new Map((json?.items ?? []).map((v) => [v.id, v]));
      items = items.map((i) => {
        const v = byId.get(i.video!.id);
        return v ? { ...i, snippet: (v.snippet?.description ?? i.snippet).slice(0, 1500), video: { ...i.video!, durationMin: v.contentDetails?.duration ? isoMinutes(v.contentDetails.duration) : null } } : i;
      });
    }
    await recordSourceStatus(s.id, true, feed.entries.length, null, true);
    return { items, result: { sourceId: s.id, name: s.name, ok: true, items: items.length } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    await recordSourceStatus(s.id, false, null, msg);
    return { items: [], result: { sourceId: s.id, name: s.name, ok: false, items: 0, error: msg } };
  }
}
