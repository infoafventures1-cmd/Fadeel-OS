// Outbound HTTP for Daily Edge. Every fetch of a feed, page or API goes through here:
// time limits, a size cap, bounded retries for temporary failures, and no requests to private addresses.

const UA = "FadeelOS-DailyEdge/1.0 (personal research reader; respects paywalls)";
const MAX_BYTES = 2_500_000;

// Test-only: when running locally (never on Vercel) EDGE_TEST_ORIGIN sends every request to a mock server.
const testOrigin = !process.env.VERCEL && process.env.EDGE_TEST_ORIGIN ? process.env.EDGE_TEST_ORIGIN : "";

export class FetchError extends Error {
  constructor(message: string, public status = 0, public temporary = false) {
    super(message);
  }
}

/** Only public http(s) hosts: no localhost, link-local or private-range IP literals */
export function isPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
  }
  if (h.startsWith("[")) return false;
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Fetched {
  status: number;
  url: string;
  text: string;
  contentType: string;
}

/**
 * GET with a timeout and up to `retries` extra attempts for 429/5xx/network errors (1s, then 3s).
 * Non-retryable statuses (401, 403, 404…) come back as a result so the caller can label the access honestly.
 */
export async function getText(url: string, opts: { headers?: Record<string, string>; timeoutMs?: number; retries?: number } = {}): Promise<Fetched> {
  if (!isPublicUrl(url)) throw new FetchError(`Blocked non-public URL: ${url}`);
  const target = testOrigin ? `${testOrigin}/${url.replace(/^https?:\/\//, "")}` : url;
  const retries = opts.retries ?? 2;
  let last: FetchError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(attempt === 1 ? 1000 : 3000);
    try {
      const res = await fetch(target, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,application/json;q=0.9,*/*;q=0.5", ...opts.headers },
        redirect: "follow",
        signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        last = new FetchError(`HTTP ${res.status}`, res.status, true);
        continue;
      }
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > MAX_BYTES) throw new FetchError(`Too large (${len} bytes)`, res.status);
      const buf = await res.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf);
      const finalUrl = testOrigin ? url : res.url || url;
      return { status: res.status, url: finalUrl, text, contentType: res.headers.get("content-type") ?? "" };
    } catch (e) {
      if (e instanceof FetchError && !e.temporary) throw e;
      last = e instanceof FetchError ? e : new FetchError(e instanceof Error && e.name === "TimeoutError" ? "Timed out" : "Network error", 0, true);
    }
  }
  throw last ?? new FetchError("Failed");
}

export async function getJson<T>(url: string, opts: { headers?: Record<string, string>; timeoutMs?: number; retries?: number } = {}): Promise<{ status: number; json: T | null }> {
  const r = await getText(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  try {
    return { status: r.status, json: JSON.parse(r.text) as T };
  } catch {
    return { status: r.status, json: null };
  }
}

/** Run tasks with at most `limit` in flight */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

/* ---------------- URLs ---------------- */

const TRACKING = /^(utm_|mc_|fbclid|gclid|cmpid|ocid|smid|ref$|ref_|guccounter|sr_share|ito$|taid|mod$|src$|cid$)/i;

/** The dedupe key: https, no www/amp/mobile prefixes, no tracking parameters, no fragment, no trailing slash */
export function canonicalUrl(raw: string) {
  try {
    const u = new URL(raw.trim());
    u.protocol = "https:";
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^(www|m|amp|mobile)\./, "");
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    let path = u.pathname.replace(/\/amp\/?$/, "/").replace(/\/+$/, "");
    if (!path) path = "/";
    u.pathname = path;
    // YouTube: the video id is the identity
    if (u.hostname === "youtu.be") return `https://youtube.com/watch?v=${path.slice(1)}`;
    if (u.hostname === "youtube.com" && u.searchParams.get("v")) return `https://youtube.com/watch?v=${u.searchParams.get("v")}`;
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw.trim();
  }
}

export const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m|amp)\./, "");
  } catch {
    return "";
  }
};

/* ---------------- text ---------------- */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…", pound: "£", euro: "€" };

export function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const safeChar = (n: number) => (n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "");

export const stripTags = (html: string) =>
  decodeEntities(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

export const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;

/** A date string → ISO instant, or null when it isn't a real date (never guessed) */
export function toIso(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v.trim());
  if (!Number.isFinite(t)) return null;
  // reject the obviously wrong: before 1990 or more than a day in the future
  if (t < Date.UTC(1990, 0, 1) || t > Date.now() + 86_400_000) return null;
  return new Date(t).toISOString();
}
