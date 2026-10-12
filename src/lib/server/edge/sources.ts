// The starting source list. A source is a discovery target, not a promise that its content is readable:
// paywalled publishers only ever contribute headlines and teasers.
//
// Provenance (checked while building this, October 2026):
// - RSS URLs below are the ones the publishers list (BIS RSS index; TechCabal's WordPress feed; FT's
//   documented ?format=rss section feeds, which carry headlines and teasers only). The sandbox this was
//   built in could not reach them, so each one is checked live by "Check sources" in Settings and on every run.
// - Reuters, Bloomberg, The Batch, the IMF and the Central Bank of Kenya publish no public feed we could
//   confirm, so they are reached through the web-search provider (site: queries). No feed URL is invented.
// - YouTube channel IDs: Damodaran, Bloomberg Television and DeepLearning.AI IDs are the ones their official
//   channel pages and several independent listings use. Y Combinator's could not be confirmed, so it is
//   stored by handle and resolved with the YouTube Data API (channels.list forHandle) when a key is set.
//   A channel only counts as verified once its live feed title matches the expected channel name.
import { sql } from "../db";
import type { SourceType, TopicKey } from "@/lib/edge";

export type SourceKind = "rss" | "search" | "youtube";

export interface SourceDef {
  id: string;
  name: string;
  kind: SourceKind;
  /** rss: feed URL */
  url?: string;
  /** search: domain for site: queries */
  site?: string;
  topic?: TopicKey;
  sourceType: SourceType;
  meta?: { channelId?: string; handle?: string; expectName?: string; idSource?: string; note?: string; window?: number };
}

export const DEFAULT_SOURCES: SourceDef[] = [
  // RSS
  { id: "techcabal", name: "TechCabal", kind: "rss", url: "https://techcabal.com/feed/", topic: "africa", sourceType: "news" },
  { id: "bis-research", name: "BIS research papers", kind: "rss", url: "https://www.bis.org/doclist/bis_fsi_publs.rss", sourceType: "research", meta: { window: 21 } },
  { id: "bis-wp", name: "BIS working papers", kind: "rss", url: "https://www.bis.org/doclist/wppubls.rss", sourceType: "preliminary", meta: { window: 21 } },
  { id: "bis-speeches", name: "Central bankers' speeches (BIS)", kind: "rss", url: "https://www.bis.org/doclist/cbspeeches.rss", sourceType: "official", meta: { window: 7 } },
  { id: "ft-alphaville", name: "FT Alphaville", kind: "rss", url: "https://www.ft.com/alphaville?format=rss", sourceType: "commentary", meta: { note: "Paywalled: headlines and teasers only" } },
  { id: "ft-financials", name: "Financial Times: Financials", kind: "rss", url: "https://www.ft.com/financials?format=rss", sourceType: "news", meta: { note: "Paywalled: headlines and teasers only" } },

  // Web search targets (need BRAVE_SEARCH_API_KEY)
  { id: "reuters", name: "Reuters (finance, technology, Future of Money)", kind: "search", site: "reuters.com", sourceType: "news" },
  { id: "bloomberg", name: "Bloomberg (Money Stuff, AI coverage)", kind: "search", site: "bloomberg.com", sourceType: "news", meta: { note: "Paywalled: headlines and snippets only" } },
  { id: "ft-search", name: "Financial Times", kind: "search", site: "ft.com", sourceType: "news", meta: { note: "Paywalled: headlines and snippets only" } },
  { id: "the-batch", name: "DeepLearning.AI: The Batch", kind: "search", site: "deeplearning.ai", topic: "ai_economics", sourceType: "commentary" },
  { id: "imf", name: "IMF research and blogs", kind: "search", site: "imf.org", sourceType: "research" },
  { id: "cbk", name: "Central Bank of Kenya", kind: "search", site: "centralbank.go.ke", topic: "africa", sourceType: "official" },
  { id: "filings", name: "SEC filings and company releases", kind: "search", site: "sec.gov", sourceType: "filing" },

  // YouTube (channel feeds need no key; the Data API key adds durations and resolves handles)
  { id: "yt-damodaran", name: "Aswath Damodaran", kind: "youtube", sourceType: "video", topic: "fundamentals", meta: { channelId: "UCLvnJL8htRR1T9cbSccaoVw", handle: "@AswathDamodaranonValuation", expectName: "Aswath Damodaran", idSource: "Listed by Social Blade, NoxInfluencer and feeder.co" } },
  { id: "yt-yc", name: "Y Combinator", kind: "youtube", sourceType: "video", topic: "ai_economics", meta: { handle: "@ycombinator", expectName: "Y Combinator", idSource: "Not confirmed: resolved from the handle with the YouTube Data API" } },
  { id: "yt-bloomberg", name: "Bloomberg Television", kind: "youtube", sourceType: "video", meta: { channelId: "UCIALMKvObZNtJ6AmdCLP7Lg", handle: "@markets", expectName: "Bloomberg Television", idSource: "Listed by vidIQ and SpeakRJ" } },
  { id: "yt-deeplearningai", name: "DeepLearning.AI", kind: "youtube", sourceType: "video", topic: "ai_economics", meta: { channelId: "UCcIXc5mJsHVYTZR1maL5l9w", handle: "@Deeplearningai", expectName: "DeepLearningAI", idSource: "The official channel page" } },
];

/** Domains whose pages are a company speaking about itself, or official/research bodies. Used to label evidence. */
export function sourceTypeForDomain(domain: string, fallback: SourceType): SourceType {
  if (/(^|\.)sec\.gov$/.test(domain)) return "filing";
  if (/^(ir|investors?|investor\.)\.|newsroom\.|press\./.test(domain) || /prnewswire|businesswire|globenewswire/.test(domain)) return "company";
  if (/(^|\.)(bis\.org|imf\.org|centralbank\.go\.ke|worldbank\.org|federalreserve\.gov|ecb\.europa\.eu|bankofengland\.co\.uk)$/.test(domain)) return fallback === "preliminary" ? "preliminary" : fallback === "research" ? "research" : "official";
  if (/arxiv\.org|ssrn\.com|nber\.org/.test(domain)) return "preliminary";
  return fallback;
}

export const PUBLISHERS: Record<string, string> = {
  "reuters.com": "Reuters",
  "bloomberg.com": "Bloomberg",
  "ft.com": "Financial Times",
  "deeplearning.ai": "DeepLearning.AI",
  "imf.org": "IMF",
  "bis.org": "BIS",
  "centralbank.go.ke": "Central Bank of Kenya",
  "techcabal.com": "TechCabal",
  "sec.gov": "SEC",
  "youtube.com": "YouTube",
};

export interface SourceRow extends SourceDef {
  enabled: boolean;
  custom: boolean;
  verifiedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastItems: number | null;
  checkedAt: string | null;
}

/** Make sure every default source has a row (new defaults appear; the owner's enable/disable choices stay) */
export async function syncSources() {
  for (const s of DEFAULT_SOURCES) {
    await sql`insert into edge_sources (id, name, kind, url, site, topic, source_type, meta)
      values (${s.id}, ${s.name}, ${s.kind}, ${s.url ?? null}, ${s.site ?? null}, ${s.topic ?? null}, ${s.sourceType}, ${JSON.stringify(s.meta ?? {})}::jsonb)
      on conflict (id) do update set name = excluded.name, url = excluded.url, site = excluded.site, topic = excluded.topic,
        source_type = excluded.source_type,
        meta = excluded.meta || jsonb_strip_nulls(jsonb_build_object('channelId', edge_sources.meta->>'channelId', 'resolvedAt', edge_sources.meta->>'resolvedAt'))
      where edge_sources.custom = false`;
  }
}

export async function listSources(): Promise<SourceRow[]> {
  await syncSources();
  const rows = await sql`select * from edge_sources order by custom, kind, name`;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    kind: r.kind as SourceKind,
    url: (r.url as string) ?? undefined,
    site: (r.site as string) ?? undefined,
    topic: (r.topic as TopicKey) ?? undefined,
    sourceType: r.source_type as SourceType,
    meta: (r.meta as SourceDef["meta"]) ?? {},
    enabled: Boolean(r.enabled),
    custom: Boolean(r.custom),
    verifiedAt: r.verified_at ? new Date(r.verified_at as string).toISOString() : null,
    lastStatus: (r.last_status as string) ?? null,
    lastError: (r.last_error as string) ?? null,
    lastItems: (r.last_items as number) ?? null,
    checkedAt: r.checked_at ? new Date(r.checked_at as string).toISOString() : null,
  }));
}

export async function recordSourceStatus(id: string, ok: boolean, items: number | null, error: string | null, verified = false) {
  await sql`update edge_sources set last_status = ${ok ? "ok" : "failed"}, last_items = ${items}, last_error = ${error ? error.slice(0, 300) : null},
    checked_at = now(), verified_at = case when ${verified} then now() else verified_at end where id = ${id}`;
}
