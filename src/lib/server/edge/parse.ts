// Parsers for what we retrieve: RSS/Atom feeds and article pages.
// All input here is untrusted web content. It is only ever read as data.
import { decodeEntities, stripTags, toIso, wordCount } from "./net";
import type { Access } from "@/lib/edge";

export interface FeedEntry {
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string;
  /** YouTube feeds only */
  videoId?: string;
  thumbnail?: string;
  author?: string;
}

export interface Feed {
  title: string;
  entries: FeedEntry[];
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : "";
};
const attr = (xml: string, name: string, a: string) => {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*\\b${a}="([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]) : "";
};

/** RSS 2.0, RSS 1.0 (RDF) and Atom. Returns null when the document isn't a feed at all. */
export function parseFeed(xml: string): Feed | null {
  if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) return null;
  const isAtom = /<feed\b/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) ?? [];
  const firstItem = xml.search(isAtom ? /<entry\b/i : /<item\b/i);
  const head = xml.slice(0, firstItem > 0 ? firstItem : 4000);
  const entries: FeedEntry[] = [];
  for (const b of blocks.slice(0, 100)) {
    let url = "";
    if (isAtom) {
      const alt = b.match(/<link\b[^>]*rel="alternate"[^>]*>/i)?.[0] ?? b.match(/<link\b[^>]*>/i)?.[0] ?? "";
      url = alt.match(/href="([^"]+)"/i)?.[1] ?? "";
    } else {
      url = tag(b, "link");
      const guid = tag(b, "guid");
      if (!url && /^https?:\/\//.test(guid)) url = guid;
      if (!url) url = b.match(/rdf:about="([^"]+)"/i)?.[1] ?? "";
    }
    url = decodeEntities(url).trim();
    const title = stripTags(tag(b, "title"));
    if (!url || !title) continue;
    const summary = stripTags(tag(b, "description") || tag(b, "summary") || tag(b, "media:description") || tag(b, "content")).slice(0, 1200);
    const publishedAt = toIso(tag(b, "pubDate") || tag(b, "published") || tag(b, "dc:date") || tag(b, "updated"));
    const videoId = tag(b, "yt:videoId") || undefined;
    entries.push({
      title,
      url,
      publishedAt,
      summary,
      videoId,
      thumbnail: attr(b, "media:thumbnail", "url") || undefined,
      author: stripTags(tag(b, "name")) || undefined,
    });
  }
  return { title: stripTags(tag(head, "title")), entries };
}

export interface Article {
  title: string;
  siteName: string;
  description: string;
  canonical: string;
  publishedAt: string | null;
  text: string;
  words: number;
  access: Access;
  accessReason: string;
}

const meta = (html: string, key: string) => {
  const re = new RegExp(`<meta\\b[^>]*(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i");
  const m = html.match(re)?.[0];
  return m ? decodeEntities(m.match(/content=["']([^"']*)["']/i)?.[1] ?? "").trim() : "";
};

function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1].trim());
      const list = Array.isArray(v) ? v : Array.isArray(v?.["@graph"]) ? v["@graph"] : [v];
      for (const x of list) if (x && typeof x === "object") out.push(x);
    } catch {}
  }
  return out;
}

const PAYWALL_MARKERS = /subscribe to (continue|read)|to continue reading|already a subscriber|this article is for subscribers|sign in to read|unlock this article|start your free trial to read/i;

/**
 * Pull the readable text and metadata out of an article page. Paywalled pages are never worked around:
 * when a page says it isn't freely accessible, only its public description and opening lines are kept.
 */
export function parseArticle(html: string, status: number): Article {
  const ld = jsonLd(html);
  const ldArticle = ld.find((x) => /Article|Report|Posting|ScholarlyArticle/i.test(String(x["@type"] ?? ""))) ?? ld[0] ?? {};
  const title = stripTags(meta(html, "og:title") || String(ldArticle.headline ?? "") || tag(html, "title"));
  const siteName = meta(html, "og:site_name");
  const description = stripTags(meta(html, "og:description") || meta(html, "description"));
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0].match(/href=["']([^"']+)["']/i)?.[1] ?? "";
  const publishedAt = toIso(meta(html, "article:published_time") || String(ldArticle.datePublished ?? "") || meta(html, "date") || meta(html, "pubdate") || meta(html, "dc.date"));

  if (status === 401 || status === 402 || status === 403) {
    return { title, siteName, description, canonical, publishedAt, text: description, words: wordCount(description), access: status === 402 ? "paywalled" : "headline", accessReason: `The site refused access (HTTP ${status}).` };
  }
  if (status >= 400) {
    return { title, siteName, description, canonical, publishedAt, text: "", words: 0, access: "headline", accessReason: `The page could not be retrieved (HTTP ${status}).` };
  }

  // body text: prefer <article>, drop page furniture
  let body = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|figure|iframe)[\s\S]*?<\/\1>/gi, " ");
  const art = body.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
  if (art) body = art;
  const paras = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1])).filter((p) => p.length > 40);
  const full = paras.join("\n\n");

  const notFree =
    ld.some((x) => x.isAccessibleForFree === false || x.isAccessibleForFree === "False" || x.isAccessibleForFree === "false") ||
    (PAYWALL_MARKERS.test(stripTags(body.slice(-20_000))) && wordCount(full) < 900);
  if (notFree) {
    const teaser = [description, ...paras.slice(0, 2)].filter(Boolean).join("\n\n").slice(0, 1500);
    return { title, siteName, description, canonical, publishedAt, text: teaser, words: wordCount(teaser), access: "paywalled", accessReason: "The publisher marks this article as subscriber-only. Only its public teaser was read." };
  }
  const words = wordCount(full);
  if (words < 150) {
    const t = [description, full].filter(Boolean).join("\n\n");
    return { title, siteName, description, canonical, publishedAt, text: t, words: wordCount(t), access: "excerpt", accessReason: "Only a short excerpt was available on the page." };
  }
  return { title, siteName, description, canonical, publishedAt, text: full.slice(0, 60_000), words, access: "full", accessReason: "" };
}
