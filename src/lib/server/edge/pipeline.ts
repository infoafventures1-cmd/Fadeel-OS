// The research run. Stages are separate and checkpointed in edge_jobs.state:
//   discover → triage → retrieve → synthesize → store
// A run that is interrupted (timeout, crash) is resumed from its last finished stage by the next trigger.
// Only one run can be active (a unique index on edge_jobs enforces it), and the day's briefing is only
// replaced when a run succeeds, so a failed refresh leaves the last good briefing in place.
import { minutesFor, type BriefingData, type EdgeSettings, type Story, type TopicKey } from "@/lib/edge";
import { localDate, fromHHMM, localMinutes, isoWeekday, addDays } from "@/lib/time";
import { modelReady } from "../ai";
import { sql } from "../db";
import { fromRss, fromSearch, fromYouTube, hasSearchKey, planQueries, type Candidate, type SourceResult } from "./discover";
import { eventDateSupported, groundList, groundParagraph, supported } from "./ground";
import { synthesize, triage, weeklySynthesis, type SynthEvent, type SynthVideo, type TriageOut } from "./llm";
import { getText, pool } from "./net";
import { parseArticle } from "./parse";
import { bestTopic, cluster, isEvergreen, jaccard, score, splitSyndicated, tokens } from "./rank";
import { listSources } from "./sources";
import { feedbackWeights, getBriefing, getItems, getWeekly, listBriefingDays, recentlyFeatured, saveBriefing, saveWeekly, setEventDate, upsertItem } from "./store";
import { CapError, SEARCH_COST, assertBudget, getEdgeSettings, recordUsage } from "./usage";

type Stage = "discover" | "triage" | "retrieve" | "synthesize" | "store" | "done";
const NEXT: Record<Stage, Stage> = { discover: "triage", triage: "retrieve", retrieve: "synthesize", synthesize: "store", store: "done", done: "done" };

/** Publishers whose articles are subscriber-only: never fetched, only their public headline/teaser is used */
const PAYWALLED = /(^|\.)(ft\.com|bloomberg\.com|wsj\.com|economist\.com|theinformation\.com|barrons\.com|nytimes\.com)$/;

interface ClusterPick {
  key: string;
  members: number[]; // indexes into state.candidates
  score: number;
  topic: TopicKey;
}

interface JobState {
  candidates?: Candidate[];
  videos?: Candidate[];
  sourceResults?: SourceResult[];
  triage?: Record<string, TriageOut>;
  scores?: number[];
  clusters?: ClusterPick[];
  itemIds?: Record<string, string>; // canonical → item id
  videoIds?: string[];
  briefing?: BriefingData;
  notes?: string[];
}

export interface Job {
  id: string;
  kind: string;
  day: string;
  stage: Stage;
  state: JobState;
}

const log = (id: string, msg: string) =>
  sql`update edge_jobs set log = (log || ${JSON.stringify([{ at: new Date().toISOString(), msg: msg.slice(0, 300) }])}::jsonb), heartbeat_at = now() where id = ${id}`;

async function save(job: Job) {
  await sql`update edge_jobs set stage = ${job.stage}, state = ${JSON.stringify(job.state)}::jsonb, heartbeat_at = now() where id = ${job.id}`;
}

/* ---------------- locking and triggers ---------------- */

export type StartResult = { status: "started" | "resumed"; jobId: string } | { status: "busy" | "skipped"; reason: string; jobId?: string };

const isUniqueViolation = (e: unknown) => {
  const x = e as { code?: string; message?: string };
  return x?.code === "23505" || /edge_jobs_one_running|duplicate key/i.test(x?.message ?? "");
};

/**
 * Claim the single run slot. A recent unfinished run for the same day is resumed (up to 3 attempts in total);
 * otherwise a new run starts. If another run is active, nothing starts.
 */
export async function acquire(trigger: "cron" | "manual" | "catch-up", opts: { force?: boolean } = {}): Promise<StartResult> {
  const day = localDate();
  // a run with no heartbeat for 6 minutes was killed (timeout or crash): mark it so it can be resumed
  await sql`update edge_jobs set status = 'failed', error = 'Interrupted: no progress for 6 minutes. It resumes from its last finished stage on the next refresh.', finished_at = now()
    where status = 'running' and heartbeat_at < now() - interval '6 minutes'`;
  const [running] = await sql`select id from edge_jobs where status = 'running' limit 1`;
  if (running) return { status: "busy", reason: "A research run is already in progress.", jobId: String(running.id) };

  if (!opts.force && (await getBriefing(day))) return { status: "skipped", reason: "Today's briefing already exists." };
  // automatic triggers stand down after a run has failed three times today; a manual refresh can still try
  if (trigger !== "manual") {
    const [spent] = await sql`select 1 from edge_jobs where day = ${day} and status = 'failed' and attempts >= 3 limit 1`;
    if (spent) return { status: "skipped", reason: "Today's run failed three times. Press Refresh now to try again." };
  }

  try {
    const [resumed] = await sql`update edge_jobs set status = 'running', attempts = attempts + 1, heartbeat_at = now(), error = null, finished_at = null, trigger = ${trigger}
      where id = (select id from edge_jobs where day = ${day} and kind = 'daily' and status = 'failed' and stage not in ('discover','done')
                  and attempts < 3 and started_at > now() - interval '12 hours' order by started_at desc limit 1)
      returning id`;
    if (resumed) {
      await log(String(resumed.id), `Resumed by ${trigger}`);
      return { status: "resumed", jobId: String(resumed.id) };
    }
    const [row] = await sql`insert into edge_jobs (kind, day, trigger) values ('daily', ${day}, ${trigger}) returning id`;
    await log(String(row.id), `Started by ${trigger}`);
    return { status: "started", jobId: String(row.id) };
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "busy", reason: "A research run is already in progress." };
    throw e;
  }
}

async function loadJob(id: string): Promise<Job | null> {
  const [r] = await sql`select id, kind, day::text as day, stage, state from edge_jobs where id = ${id} and status = 'running'`;
  return r ? { id: String(r.id), kind: String(r.kind), day: String(r.day), stage: r.stage as Stage, state: (r.state as JobState) ?? {} } : null;
}

async function finish(id: string, status: "done" | "failed", error?: string) {
  await sql`update edge_jobs set status = ${status}, error = ${error ?? null}, finished_at = now(), heartbeat_at = now() where id = ${id}`;
}

/** Run (or continue) a job until it finishes or the time budget runs out. Never throws. */
export async function runJob(jobId: string, budgetMs = 270_000) {
  const deadline = Date.now() + budgetMs;
  const job = await loadJob(jobId);
  if (!job) return;
  const settings = await getEdgeSettings();
  try {
    while (job.stage !== "done") {
      const left = deadline - Date.now();
      const need = job.stage === "synthesize" ? 125_000 : 45_000;
      if (left < need) {
        await log(job.id, `Paused before ${job.stage}: not enough time left in this invocation`);
        await finish(job.id, "failed", `Paused before the ${job.stage} stage (time limit). It resumes on the next refresh.`);
        return;
      }
      await log(job.id, `Stage: ${job.stage}`);
      const stop = await STAGES[job.stage](job, settings);
      if (stop) {
        await save(job);
        await finish(job.id, "done");
        await log(job.id, stop);
        return;
      }
      job.stage = NEXT[job.stage];
      await save(job);
    }
    await finish(job.id, "done");
    await log(job.id, "Finished");
  } catch (e) {
    const msg = e instanceof CapError ? e.message : e instanceof Error ? e.message : "Unknown error";
    console.error("Daily Edge run failed", e);
    await log(job.id, `Failed at ${job.stage}: ${msg}`);
    await finish(job.id, "failed", `${job.stage}: ${msg}`);
  }
}

/* ---------------- stages ---------------- */

type StageFn = (job: Job, s: EdgeSettings) => Promise<string | void>;

const discover: StageFn = async (job, settings) => {
  const sources = (await listSources()).filter((s) => s.enabled);
  const notes: string[] = [];
  const rss = sources.filter((s) => s.kind === "rss");
  const yt = sources.filter((s) => s.kind === "youtube");
  const search = sources.filter((s) => s.kind === "search");

  const [rssOut, ytOut] = await Promise.all([pool(rss, 6, fromRss), pool(yt, 4, fromYouTube)]);
  let searchOut: { items: Candidate[]; results: SourceResult[]; queries: number } = { items: [], results: [], queries: 0 };
  if (hasSearchKey()) {
    searchOut = await fromSearch(planQueries(settings, search), async () => {
      await assertBudget(SEARCH_COST);
      await recordUsage({ provider: "brave", purpose: "search", costUsd: SEARCH_COST, jobId: job.id });
    });
  } else {
    notes.push(`Web search isn't set up (BRAVE_SEARCH_API_KEY), so ${search.map((s) => s.name.split(" (")[0]).join(", ")} weren't searched today.`);
  }

  const all = [...rssOut.flatMap((r) => r.items), ...searchOut.items];
  const results = [...rssOut.map((r) => r.result), ...ytOut.map((r) => r.result), ...searchOut.results];

  // dedupe by canonical URL; skip anything featured as a story in the last 7 days
  const featured = await recentlyFeatured(job.day);
  const featuredCanon = new Set(
    featured.itemIds.size ? (await sql`select canonical_url from edge_items where id = any(${[...featured.itemIds]}::uuid[])`).map((r) => String(r.canonical_url)) : []
  );
  const seen = new Set<string>();
  const fresh = all.filter((c) => {
    if (seen.has(c.canonical) || featuredCanon.has(c.canonical)) return false;
    seen.add(c.canonical);
    return true;
  });

  // first cheap pass: keyword relevance × weights × quality × freshness; keep the best for triage
  const fb = await feedbackWeights();
  const scored = fresh
    .map((c) => ({ c, s: score(c, settings, { feedbackTopic: fb.topic.get(bestTopic(c).topic), feedbackDomain: fb.domain.get(c.domain) }) }))
    .sort((a, b) => b.s - a.s);
  job.state.candidates = scored.slice(0, settings.maxCandidates).map((x) => x.c);
  job.state.videos = ytOut.flatMap((r) => r.items).filter((v) => !featuredCanon.has(v.canonical)).slice(0, 30);
  job.state.sourceResults = results;
  job.state.notes = notes;
  await log(job.id, `Discovered ${all.length} items (${fresh.length} new after dedupe), kept ${job.state.candidates.length} for triage; ${job.state.videos.length} videos; ${results.filter((r) => !r.ok).length} sources failed`);
  if (!job.state.candidates.length && !job.state.videos.length) {
    job.state.notes.push("No sources returned anything new today.");
  }
};

const triageStage: StageFn = async (job, settings) => {
  const cands = job.state.candidates ?? [];
  const tri: Record<string, TriageOut> = {};
  if (cands.length && modelReady(settings.triageModel)) {
    const out = await triage(
      settings.triageModel,
      settings,
      cands.map((c, i) => ({ i, title: c.title, publisher: c.publisher, date: c.publishedAt, snippet: c.snippet })),
      job.id
    );
    for (const [i, t] of out) tri[i] = t;
  } else if (cands.length) {
    job.state.notes?.push("Triage used keyword matching only (the triage AI model isn't connected).");
  }
  const fb = await feedbackWeights();
  const scores = cands.map((c, i) => {
    const t = tri[i];
    const topic = t?.topic ?? bestTopic(c).topic;
    return score(c, settings, {
      topic,
      relevance: t ? t.relevance / 5 : undefined,
      learning: t ? t.learning / 5 : undefined,
      feedbackTopic: fb.topic.get(topic),
      feedbackDomain: fb.domain.get(c.domain),
    });
  });
  // drop what triage judged irrelevant; group the rest by underlying event
  const keep = cands.map((c, i) => ({ c, i })).filter(({ i }) => !tri[i] || (tri[i].relevance >= 2 && tri[i].topic !== null));
  const groups = cluster(keep.map(({ c, i }) => ({ key: c.canonical, title: c.title, snippet: c.snippet, domain: c.domain, publishedAt: c.publishedAt, event: tri[i]?.event ?? null, i })));
  const picks: ClusterPick[] = groups
    .map((g) => {
      const idx = g.map((x) => x.i).sort((a, b) => scores[b] - scores[a]);
      const { independent } = splitSyndicated(g);
      const top = idx[0];
      return {
        key: tri[top]?.event ?? `c-${top}`,
        members: idx,
        // corroboration from independent outlets raises an event; syndicated copies do not
        score: scores[top] + Math.min(independent.length - 1, 2) * 0.04,
        topic: tri[top]?.topic ?? bestTopic(cands[top]).topic,
      };
    })
    .sort((a, b) => b.score - a.score);
  // don't cover an event again that was a story in the last 7 days (same event key, or a near-identical headline)
  const featured = await recentlyFeatured(job.day);
  const featuredTok = featured.titles.map(tokens);
  const repeat = (c: ClusterPick) => featured.events.has(c.key) || c.members.some((i) => featuredTok.some((ft) => jaccard(tokens(cands[i].title), ft) >= 0.6));
  const repeats = picks.filter(repeat).length;
  if (repeats) job.state.notes?.push(`Skipped ${repeats} event${repeats === 1 ? "" : "s"} already covered in the last 7 days.`);
  picks.splice(0, picks.length, ...picks.filter((c) => !repeat(c)));
  job.state.triage = tri;
  job.state.scores = scores;
  job.state.clusters = picks.slice(0, 6);
  await log(job.id, `Triage kept ${keep.length} of ${cands.length}; ${groups.length} distinct events, top ${job.state.clusters.length} go to retrieval`);
};

const retrieve: StageFn = async (job, settings) => {
  const cands = job.state.candidates ?? [];
  const tri = job.state.triage ?? {};
  const scores = job.state.scores ?? [];
  const itemIds: Record<string, string> = job.state.itemIds ?? {};
  // fetch the best report of each event plus one independent corroborating report, within the retrieval limit
  const toFetch: number[] = [];
  for (const c of job.state.clusters ?? []) {
    const members = c.members.map((i) => ({ ...cands[i], key: cands[i].canonical, i }));
    const { independent } = splitSyndicated(members);
    for (const m of independent.slice(0, 2)) if (toFetch.length < settings.maxRetrieve) toFetch.push(m.i);
  }
  const fetched = new Map<number, ReturnType<typeof parseArticle>>();
  await pool(toFetch, 5, async (i) => {
    const c = cands[i];
    if (PAYWALLED.test(c.domain)) return; // never fetched: headline + teaser only
    try {
      const r = await getText(c.url, { timeoutMs: 15_000 });
      fetched.set(i, parseArticle(r.text, r.status));
    } catch (e) {
      fetched.set(i, { title: c.title, siteName: "", description: "", canonical: "", publishedAt: null, text: "", words: 0, access: "headline", accessReason: e instanceof Error ? e.message : "Fetch failed" });
    }
  });

  // store every member of the chosen events (retrieved or not), so Explore and corroboration links work
  const now = new Date().toISOString();
  const members = new Set((job.state.clusters ?? []).flatMap((c) => c.members));
  for (const i of members) {
    const c = cands[i];
    const a = fetched.get(i);
    const paywalled = PAYWALLED.test(c.domain);
    const access = a ? a.access : paywalled ? "paywalled" : "headline";
    const publishedAt = c.publishedAt ?? a?.publishedAt ?? null;
    itemIds[c.canonical] = await upsertItem({
      canonical: c.canonical,
      url: c.url,
      title: c.title,
      publisher: c.publisher,
      domain: c.domain,
      kind: "article",
      sourceId: c.sourceId,
      topic: tri[i]?.topic ?? bestTopic(c).topic,
      sourceType: tri[i]?.type ?? c.sourceType,
      access,
      publishedAt,
      retrievedAt: a ? now : null,
      snippet: c.snippet,
      content: a && (a.access === "full" || a.access === "excerpt" || a.access === "paywalled") ? a.text : "",
      words: a?.words ?? 0,
      evergreen: isEvergreen({ publishedAt, sourceType: c.sourceType }),
      cluster: (job.state.clusters ?? []).find((x) => x.members.includes(i))?.key ?? null,
      score: scores[i] ?? 0,
      meta: { via: c.via, accessReason: a?.accessReason ?? (paywalled ? "Subscriber-only publisher: not fetched" : "Not retrieved (lower-ranked report of this event)") },
    });
  }
  // the rest of today's discoveries become Explore items (headline only); their full text is never claimed
  for (const [i, c] of cands.entries()) {
    if (members.has(i) || itemIds[c.canonical]) continue;
    if (tri[i] && tri[i].relevance < 2) continue;
    itemIds[c.canonical] = await upsertItem({
      canonical: c.canonical, url: c.url, title: c.title, publisher: c.publisher, domain: c.domain, kind: "article", sourceId: c.sourceId,
      topic: tri[i]?.topic ?? bestTopic(c).topic, sourceType: tri[i]?.type ?? c.sourceType, access: PAYWALLED.test(c.domain) ? "paywalled" : "headline",
      publishedAt: c.publishedAt, retrievedAt: null, snippet: c.snippet, content: "", words: 0,
      evergreen: isEvergreen({ publishedAt: c.publishedAt, sourceType: c.sourceType }), cluster: null, score: scores[i] ?? 0, meta: { via: c.via },
    });
  }
  const videoIds: string[] = [];
  for (const v of job.state.videos ?? []) {
    const id = await upsertItem({
      canonical: v.canonical, url: v.url, title: v.title, publisher: v.publisher, domain: "youtube.com", kind: "video", sourceId: v.sourceId,
      topic: bestTopic(v).topic, sourceType: "video", access: "video", publishedAt: v.publishedAt, retrievedAt: now, snippet: v.snippet,
      content: "", words: 0, evergreen: isEvergreen({ publishedAt: v.publishedAt, sourceType: "video" }), cluster: null,
      score: score(v, settings), meta: { channel: v.video?.channel, durationMin: v.video?.durationMin ?? null, thumbnail: v.video?.thumbnail ?? null, transcript: "unavailable" },
    });
    videoIds.push(id);
  }
  job.state.itemIds = itemIds;
  job.state.videoIds = videoIds;
  const full = [...fetched.values()].filter((a) => a.access === "full").length;
  await log(job.id, `Retrieved ${fetched.size} articles (${full} full text); stored ${Object.keys(itemIds).length} items and ${videoIds.length} videos`);
};

const synthesizeStage: StageFn = async (job, settings) => {
  if (!modelReady(settings.synthModel)) {
    return "No briefing written: the AI model for synthesis isn't connected. Today's discoveries are in Explore.";
  }
  const cands = job.state.candidates ?? [];
  const itemIds = job.state.itemIds ?? {};
  const clusters = job.state.clusters ?? [];
  if (!clusters.length) {
    job.state.briefing = emptyBriefing(job, settings, ["Little worthwhile news today: nothing new passed the relevance bar."]);
    return;
  }

  // documents per event, with the text we actually retrieved (or the snippet, clearly marked)
  const allIds = clusters.flatMap((c) => c.members.map((i) => itemIds[cands[i].canonical]).filter(Boolean));
  const withContent = new Map(
    (await sql`select id, content, access, words from edge_items where id = any(${allIds}::uuid[])`).map((r) => [String(r.id), { content: String(r.content ?? ""), access: String(r.access) }])
  );
  let d = 0;
  const docMap = new Map<string, { itemId: string; text: string; candidate: Candidate }>();
  const events: SynthEvent[] = clusters.map((c, ci) => {
    const members = c.members.map((i) => ({ ...cands[i], key: cands[i].canonical, i }));
    const { independent } = splitSyndicated(members);
    return {
      id: `E${ci + 1}`,
      docs: independent.slice(0, 3).map((m) => {
        const itemId = itemIds[m.canonical];
        const stored = withContent.get(itemId);
        const text = stored?.content ? stored.content.slice(0, 5000) : m.snippet;
        const id = `D${++d}`;
        docMap.set(id, { itemId, text: `${m.title}\n${m.snippet}\n${stored?.content ?? ""}`, candidate: m });
        return { id, publisher: m.publisher, title: m.title, published: m.publishedAt, access: stored?.access ?? "headline", type: m.sourceType, text };
      }),
    };
  });

  const rankedVideos = (await getItems(job.state.videoIds ?? []))
    .sort((a, b) => (b.topic ? settings.weights[b.topic] : 0) - (a.topic ? settings.weights[a.topic] : 0))
    .slice(0, 6);
  const videos: SynthVideo[] = rankedVideos.map((v, i) => ({ id: `V${i + 1}`, title: v.title, channel: v.channel ?? v.publisher, published: v.publishedAt, minutes: v.durationMin ?? null, description: v.snippet }));

  const recentConcepts = (await listBriefingDays(10)).map((b) => b.data.concept?.title).filter(Boolean) as string[];
  const raw = await synthesize(settings.synthModel, settings, events, videos, recentConcepts, job.id);

  // map back to stored items and run the grounding check
  const notes = [...(job.state.notes ?? []), ...raw.notes];
  const stories: Story[] = [];
  const usedEvents = new Set<string>();
  let removedTotal = 0;
  for (const s of raw.stories) {
    const ev = events.find((e) => e.id === s.event);
    if (!ev || usedEvents.has(ev.id)) continue;
    const primaryDoc = ev.docs.find((x) => x.id === s.primary) ?? ev.docs[0];
    const primary = docMap.get(primaryDoc.id);
    if (!primary?.itemId) continue;
    const source = ev.docs.map((x) => docMap.get(x.id)?.text ?? "").join("\n\n");
    const what = groundParagraph(s.whatHappened, source);
    if (!what.text) {
      notes.push("One story was dropped because its summary couldn't be matched to the retrieved sources.");
      continue;
    }
    usedEvents.add(ev.id);
    const why = groundParagraph(s.whyItMatters, source);
    const est = groundList(s.established, source);
    const interp = groundList(s.interpretation, source);
    const unc = groundList(s.uncertain, source);
    const mech = s.mechanism.filter((m) => supported(m.text, source));
    const removed = what.removed + why.removed + est.removed + interp.removed + unc.removed + (s.mechanism.length - mech.length);
    removedTotal += removed;
    const cluster = clusters[Number(ev.id.slice(1)) - 1];
    const members = cluster.members.map((i) => ({ ...cands[i], key: cands[i].canonical }));
    const split = splitSyndicated(members);
    const primaryCand = primary.candidate;
    const primaryAccess = withContent.get(primary.itemId)?.access ?? "headline";
    const pubDay = primaryCand.publishedAt ? localDate(primaryCand.publishedAt) : null;
    const eventDate = s.eventDate && s.eventDate !== pubDay && eventDateSupported(s.eventDate, source) ? s.eventDate : null;
    if (eventDate) await setEventDate(primary.itemId, eventDate);
    stories.push({
      id: `${job.day}-${ev.id}`,
      itemId: primary.itemId,
      corroboratingIds: split.independent.filter((m) => m.canonical !== primaryCand.canonical).map((m) => itemIds[m.canonical]).filter(Boolean),
      syndicatedIds: split.syndicated.map((m) => itemIds[m.canonical]).filter(Boolean),
      topic: s.topic,
      sourceType: job.state.triage?.[cands.findIndex((c) => c.canonical === primaryCand.canonical)]?.type ?? primaryCand.sourceType,
      whatHappened: what.text,
      whyItMatters: why.text,
      mechanism: mech,
      established: est.list,
      interpretation: interp.list,
      uncertain: unc.list,
      question: supported(s.question, source) ? s.question : "",
      recall: s.recall && supported(`${s.recall.q} ${s.recall.a}`, source) ? s.recall : null,
      eventDate,
      accessNote:
        primaryAccess === "full"
          ? null
          : primaryAccess === "paywalled"
            ? "Subscriber-only article: summarised from its public headline and teaser only. The full article was not read."
            : primaryAccess === "excerpt"
              ? "Only an excerpt was available: the full article was not read."
              : "Summarised from the headline and search snippet only: the article itself was not read.",
      removed,
      event: cluster.key,
    });
  }
  if (removedTotal) notes.push(`${removedTotal} AI-written statement${removedTotal === 1 ? " was" : "s were"} removed because their figures or quotes weren't in the sources.`);
  if (stories.length < 3) notes.push(stories.length ? `Only ${stories.length} development${stories.length === 1 ? "" : "s"} met the bar today.` : "No development met the bar today.");

  const deepDoc = raw.deepRead ? docMap.get(raw.deepRead.doc) : null;
  const deepItem = deepDoc ? (await getItems([deepDoc.itemId]))[0] : null;
  const deepMinutes = deepItem ? minutesFor(deepItem.words || 600) : 0;
  const vIdx = raw.video ? Number(raw.video.id.replace(/\D/g, "")) - 1 : -1;
  const vItem = vIdx >= 0 ? (rankedVideos[vIdx] ?? null) : null;

  const deepRead = deepItem && raw.deepRead ? { itemId: deepItem.id, why: raw.deepRead.why, minutes: deepMinutes, optional: deepMinutes > 8 || deepItem.access !== "full" } : null;
  const core = stories.length * 3 + (raw.concept ? 5 : 0) + (raw.exercise ? 4 : 0) + (deepRead && !deepRead.optional ? deepRead.minutes : 0);

  job.state.briefing = {
    stories,
    deepRead,
    concept: raw.concept,
    video: vItem && raw.video ? { itemId: vItem.id, why: raw.video.why, optional: vItem.durationMin == null || vItem.durationMin > 10 } : null,
    exercise: raw.exercise,
    notes,
    sourceFailures: (job.state.sourceResults ?? []).filter((r) => !r.ok).map((r) => ({ name: r.name, error: r.error ?? "Failed" })),
    coreMinutes: Math.min(core, 25),
    generatedAt: new Date().toISOString(),
    model: settings.synthModel,
  };
};

function emptyBriefing(job: Job, settings: EdgeSettings, extra: string[]): BriefingData {
  return {
    stories: [],
    deepRead: null,
    concept: null,
    video: null,
    exercise: null,
    notes: [...(job.state.notes ?? []), ...extra],
    sourceFailures: (job.state.sourceResults ?? []).filter((r) => !r.ok).map((r) => ({ name: r.name, error: r.error ?? "Failed" })),
    coreMinutes: 0,
    generatedAt: new Date().toISOString(),
    model: settings.synthModel,
  };
}

const store: StageFn = async (job) => {
  if (job.state.briefing) {
    await saveBriefing(job.day, job.id, job.state.briefing);
    await log(job.id, `Saved briefing for ${job.day}: ${job.state.briefing.stories.length} stories`);
  }
};

const STAGES: Record<Stage, StageFn> = { discover, triage: triageStage, retrieve, synthesize: synthesizeStage, store, done: async () => {} };

/* ---------------- schedule helpers ---------------- */

/** Monday of the week containing `day` */
export const weekStart = (day: string) => addDays(day, 1 - isoWeekday(day));

/** Weekly synthesis from the last 7 days of briefings. Needs at least three stories. */
export async function runWeekly(force = false) {
  const settings = await getEdgeSettings();
  const today = localDate();
  const ws = weekStart(today);
  if (!force && (await getWeekly(ws))) return { ok: true as const, weekStart: ws, skipped: true };
  if (!modelReady(settings.synthModel)) return { ok: false as const, error: "The AI model isn't connected." };
  const days = (await listBriefingDays(7)).filter((b) => b.day >= addDays(today, -7));
  const stories = days.flatMap((b) => b.data.stories);
  if (stories.length < 3) return { ok: false as const, error: "Needs at least three stories from the last 7 days." };
  const items = new Map((await getItems(stories.map((s) => s.itemId))).map((i) => [i.id, i]));
  const input = stories.map((s, n) => {
    const it = items.get(s.itemId);
    return { id: `S${n + 1}`, title: it?.title ?? "", publisher: it?.publisher ?? "", date: it?.publishedAt ? localDate(it.publishedAt) : null, text: [s.whatHappened, ...s.established, ...s.interpretation].join(" ") };
  });
  const raw = await weeklySynthesis(settings.synthModel, input);
  const source = input.map((x) => `${x.title} ${x.text}`).join("\n");
  const mapIds = (ids: string[]) => ids.map((x) => stories[Number(x.replace(/\D/g, "")) - 1]?.itemId).filter(Boolean) as string[];
  const data = {
    connections: raw.connections.filter((c) => supported(c.text, source)).map((c) => ({ title: c.title, text: c.text, itemIds: mapIds(c.ids) })),
    disagreement: raw.disagreement && supported(raw.disagreement.text, source) ? { title: raw.disagreement.title, text: raw.disagreement.text, itemIds: mapIds(raw.disagreement.ids) } : null,
    hypothesis: raw.hypothesis,
    experiment: raw.experiment,
    generatedAt: new Date().toISOString(),
  };
  await saveWeekly(ws, data);
  return { ok: true as const, weekStart: ws, skipped: false };
}

/** Whether the on-visit catch-up should start today's run: past the preferred time, nothing run yet today */
export async function catchUpDue() {
  const settings = await getEdgeSettings();
  const day = localDate();
  if (localMinutes() < fromHHMM(settings.refreshTime)) return false;
  if (!modelReady(settings.synthModel)) return false;
  const [any] = await sql`select 1 from edge_jobs where day = ${day} limit 1`;
  if (any) return false;
  return !(await getBriefing(day));
}
