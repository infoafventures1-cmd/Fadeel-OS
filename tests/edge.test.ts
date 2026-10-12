// Daily Edge unit checks (parsers, URL dedupe, ranking, clustering, syndication, grounding). Run: npx tsx tests/edge.test.ts
import assert from "node:assert/strict";
import { parseFeed, parseArticle } from "../src/lib/server/edge/parse";
import { canonicalUrl, isPublicUrl, toIso } from "../src/lib/server/edge/net";
import { cluster, splitSyndicated, bestTopic, freshness, score } from "../src/lib/server/edge/rank";
import { figures, supported, groundParagraph, eventDateSupported } from "../src/lib/server/edge/ground";
import { validateBriefing } from "../src/lib/server/edge/llm";
import { DEFAULT_EDGE_SETTINGS } from "../src/lib/edge";
let n = 0; const t = (name: string, f: () => void) => { f(); n++; console.log("ok", name); };

t("rss 2.0", () => {
  const f = parseFeed(`<?xml version="1.0"?><rss><channel><title>TechCabal</title><item><title><![CDATA[M-Pesa &amp; fees]]></title><link>https://techcabal.com/2026/10/10/mpesa/</link><pubDate>Fri, 10 Oct 2026 08:00:00 +0000</pubDate><description><![CDATA[<p>Safaricom cut fees</p>]]></description></item></channel></rss>`)!;
  assert.equal(f.title, "TechCabal"); assert.equal(f.entries[0].title, "M-Pesa & fees");
  assert.equal(f.entries[0].url, "https://techcabal.com/2026/10/10/mpesa/"); assert.equal(f.entries[0].publishedAt, "2026-10-10T08:00:00.000Z");
  assert.equal(f.entries[0].summary, "Safaricom cut fees");
});
t("atom/youtube", () => {
  const f = parseFeed(`<feed xmlns:yt="x"><title>Aswath Damodaran</title><entry><yt:videoId>abc123</yt:videoId><title>Valuation class</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/><published>2026-10-08T12:00:00+00:00</published><media:group><media:description>Session 5</media:description></media:group></entry></feed>`)!;
  assert.equal(f.title, "Aswath Damodaran"); assert.equal(f.entries[0].videoId, "abc123"); assert.equal(f.entries[0].summary, "Session 5");
});
t("not a feed", () => assert.equal(parseFeed("<html><body>hi</body></html>"), null));
t("article full text + dates", () => {
  const p = "<p>" + "The central bank cut its policy rate by 25 basis points to 9.25 percent on Tuesday. ".repeat(4) + "</p>";
  const a = parseArticle(`<html><head><meta property="og:title" content="CBK cuts rate"><meta property="article:published_time" content="2026-10-07T09:00:00Z"></head><body><nav><p>menu menu menu menu menu menu menu menu menu menu</p></nav><article>${p.repeat(12)}</article></body></html>`, 200);
  assert.equal(a.access, "full"); assert.equal(a.publishedAt, "2026-10-07T09:00:00.000Z"); assert.ok(!a.text.includes("menu"));
});
t("paywall honoured", () => {
  const a = parseArticle(`<html><head><meta property="og:description" content="Teaser text here."><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script></head><body><article>${"<p>Secret paid paragraph number one that is quite long indeed.</p>".repeat(50)}</article></body></html>`, 200);
  assert.equal(a.access, "paywalled"); assert.ok(a.text.length < 1600);
});
t("blocked = headline only", () => assert.equal(parseArticle("<html></html>", 403).access, "headline"));
t("canonical url", () => {
  assert.equal(canonicalUrl("http://www.Reuters.com/a/b/?utm_source=x&id=2#frag"), "https://reuters.com/a/b?id=2");
  assert.equal(canonicalUrl("https://youtu.be/abc"), "https://youtube.com/watch?v=abc");
  assert.equal(canonicalUrl("https://m.youtube.com/watch?v=abc&t=10"), "https://youtube.com/watch?v=abc");
});
t("ssrf guard", () => { assert.ok(!isPublicUrl("http://localhost/x")); assert.ok(!isPublicUrl("http://10.0.0.5/")); assert.ok(!isPublicUrl("file:///etc/passwd")); assert.ok(isPublicUrl("https://techcabal.com/feed/")); });
t("dates never guessed", () => { assert.equal(toIso("not a date"), null); assert.equal(toIso("2099-01-01"), null); });

const now = Date.now(), h = (x: number) => new Date(now - x * 3600e3).toISOString();
t("clustering + syndication", () => {
  const items = [
    { key: "a", title: "Kenya central bank cuts benchmark rate to 9.25%", snippet: "The CBK lowered its rate on Tuesday.", domain: "reuters.com", publishedAt: h(10) },
    { key: "b", title: "Kenya central bank cuts benchmark rate to 9.25%", snippet: "The CBK lowered its rate on Tuesday.", domain: "yahoo.com", publishedAt: h(9) },
    { key: "c", title: "CBK cuts benchmark rate to 9.25% as inflation eases", snippet: "Analysts expected the move.", domain: "businessdailyafrica.com", publishedAt: h(8) },
    { key: "d", title: "Nvidia data center revenue jumps", snippet: "Chips.", domain: "ft.com", publishedAt: h(5) },
    { key: "a", title: "dup", snippet: "", domain: "reuters.com", publishedAt: h(10) },
  ];
  // headline matching alone: the identical copy merges, the differently worded report stays separate (conservative)
  const g0 = cluster(items);
  assert.equal(g0.length, 3, JSON.stringify(g0.map((x) => x.map((y) => y.key))));
  assert.ok(g0.some((x) => x.length === 2 && x.every((y) => y.key === "a" || y.key === "b")));
  // with triage event keys, all three reports of the rate cut become one event
  const keyed = items.map((i) => ({ ...i, event: i.key === "d" ? "nvda" : "cbk-cut" }));
  const g = cluster(keyed);
  assert.equal(g.length, 2, JSON.stringify(g.map((x) => x.map((y) => y.key))));
  const cbk = g.find((x) => x.some((y) => y.key === "a"))!;
  const s = splitSyndicated(cbk);
  assert.deepEqual(s.independent.map((x) => x.key).sort(), ["a", "c"]); assert.deepEqual(s.syndicated.map((x) => x.key), ["b"]);
});
t("event keys merge clusters", () => {
  const g = cluster([{ key: "x", title: "Safaricom results", snippet: "", domain: "a.com", publishedAt: h(1), event: "saf-h1" }, { key: "y", title: "M-Pesa profit climbs", snippet: "", domain: "b.com", publishedAt: h(2), event: "saf-h1" }]);
  assert.equal(g.length, 1);
});
t("topic + freshness + ranking", () => {
  assert.equal(bestTopic({ title: "Bank deploys AI to catch card fraud", snippet: "", domain: "x", publishedAt: null, sourceType: "news", topicHint: null, kind: "article" }).topic, "ai_finance");
  assert.equal(bestTopic({ title: "M-Pesa mobile money in Kenya grows", snippet: "", domain: "x", publishedAt: null, sourceType: "news", topicHint: null, kind: "article" }).topic, "africa");
  assert.equal(freshness(h(20)), 1); assert.ok(freshness(h(150)) < 0.6); assert.ok(freshness(h(400)) < 0.2);
  const base = { title: "Bank deploys AI to catch card fraud", snippet: "", domain: "reuters.com", sourceType: "news" as const, topicHint: null, kind: "article" as const };
  assert.ok(score({ ...base, publishedAt: h(5) }, DEFAULT_EDGE_SETTINGS) > score({ ...base, publishedAt: h(150) }, DEFAULT_EDGE_SETTINGS), "fresher ranks higher");
});
const SRC = "The Central Bank of Kenya cut its rate by 25 basis points to 9.25 percent on October 7. Lending to small firms rose 1,200 loans. “We expect inflation to stay within target this year,” the governor said.";
t("grounding: figures", () => {
  assert.deepEqual(figures("$1,200 and 9.25% in 2026, 3 banks"), ["1200", "9.25", "2026"]);
  assert.ok(supported("The bank cut rates to 9.25 percent.", SRC));
  assert.ok(supported("It made 1200 loans.", SRC));
  assert.ok(!supported("Rates fell to 8.75 percent.", SRC));
  assert.ok(!supported("The cut was 50 basis points.", SRC));
});
t("grounding: quotes", () => {
  assert.ok(supported("The governor said “we expect inflation to stay within target this year”.", SRC));
  assert.ok(!supported("The governor said “we will cut again next month for sure”.", SRC));
});
t("grounding: paragraphs", () => {
  const g = groundParagraph("The CBK cut rates to 9.25%. Inflation will hit 3.1% next year. This helps borrowers.", SRC);
  assert.equal(g.removed, 1); assert.ok(!g.text.includes("3.1"));
});
t("event dates", () => { assert.ok(eventDateSupported("2026-10-07", SRC)); assert.ok(!eventDateSupported("2026-10-08", SRC)); assert.ok(eventDateSupported("2026-10-07", "on 7 Oct the bank")); });
t("validate AI output", () => {
  const b = validateBriefing({ stories: [{ event: "E1", primary: "D1", topic: "bogus", whatHappened: "x", mechanism: [{ lever: "costs", text: "y" }, { lever: "magic", text: "z" }], recall: { q: "q" } }, { event: "", primary: "D2", whatHappened: "x" }], concept: { title: "NIM", plain: "p", example: { setup: "s", steps: ["a"], result: "r" }, diagram: { nodes: ["one"] } }, video: null, exercise: { prompt: "p" } });
  assert.equal(b.stories.length, 1); assert.equal(b.stories[0].topic, "ai_finance"); assert.equal(b.stories[0].mechanism.length, 1); assert.equal(b.stories[0].recall, null);
  assert.equal(b.concept?.diagram, null); assert.equal(b.exercise?.answer, "");
});
console.log(`\n${n} unit checks passed`);
