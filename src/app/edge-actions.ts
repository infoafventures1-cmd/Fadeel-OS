"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireSession } from "@/lib/server/auth";
import { acquire, runJob, runWeekly } from "@/lib/server/edge/pipeline";
import * as learn from "@/lib/server/edge/learn";
import { fromRss, fromYouTube } from "@/lib/server/edge/discover";
import { isPublicUrl } from "@/lib/server/edge/net";
import { listSources } from "@/lib/server/edge/sources";
import { getEdgeSettings, saveEdgeSettings, CapError } from "@/lib/server/edge/usage";
import { sql } from "@/lib/server/db";
import { DEFAULT_EDGE_SETTINGS, TOPICS, type EdgeSettings } from "@/lib/edge";
import { AI_MODELS } from "@/config";

// Server actions for Daily Edge. Every one checks the session first; API keys stay on the server.
const refresh = () => revalidatePath("/", "layout");
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof CapError || e instanceof Error ? e.message : "Something went wrong." });

/** Manual refresh: claims the run slot and continues in the background (the page polls for status) */
export async function refreshEdgeAction() {
  await requireSession();
  const r = await acquire("manual", { force: true });
  if (r.status === "started" || r.status === "resumed") {
    const id = r.jobId;
    after(() => runJob(id, 270_000));
  }
  refresh();
  return r;
}

export async function weeklyAction() {
  await requireSession();
  try {
    const r = await runWeekly(true);
    refresh();
    return r;
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- learning ---------------- */

export async function saveItemAction(id: string, saved: boolean) {
  await requireSession();
  await learn.setSaved(id, saved);
  refresh();
}

export async function readItemAction(id: string, read: boolean) {
  await requireSession();
  await learn.setRead(id, read);
  refresh();
}

export async function takeawayAction(id: string, text: string) {
  await requireSession();
  await learn.saveTakeaway(id, text);
  refresh();
}

export async function feedbackAction(id: string, signal: 1 | -1) {
  await requireSession();
  await learn.addFeedback(id, signal === 1 ? 1 : -1);
}

export async function learnedAction(day: string, kind: "story" | "concept", storyId?: string) {
  await requireSession();
  const ok = await learn.learnFromBriefing(day, kind, storyId);
  refresh();
  return ok;
}

export async function reviewAction(id: string, got: boolean) {
  await requireSession();
  await learn.answerReview(id, got);
  refresh();
}

export async function simplerAction(id: string, summary: string) {
  await requireSession();
  try {
    return { ok: true as const, text: await learn.simpler(id, summary.slice(0, 2000)) };
  } catch (e) {
    return fail(e);
  }
}

export async function connectAction(id: string, summary: string) {
  await requireSession();
  try {
    return { ok: true as const, connect: await learn.connect(id, summary.slice(0, 2000)) };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- settings and sources ---------------- */

const clampInt = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export async function saveEdgeSettingsAction(input: EdgeSettings) {
  await requireSession();
  const d = DEFAULT_EDGE_SETTINGS;
  const modelIds = AI_MODELS.map((m) => m.id);
  const weights = Object.fromEntries(TOPICS.map((t) => [t.key, clampInt(input.weights?.[t.key], 0, 100, d.weights[t.key])])) as EdgeSettings["weights"];
  const s: EdgeSettings = {
    weights,
    refreshTime: /^\d{2}:\d{2}$/.test(input.refreshTime) ? input.refreshTime : d.refreshTime,
    maxSearchQueries: clampInt(input.maxSearchQueries, 0, 40, d.maxSearchQueries),
    maxCandidates: clampInt(input.maxCandidates, 10, 80, d.maxCandidates),
    maxRetrieve: clampInt(input.maxRetrieve, 0, 20, d.maxRetrieve),
    monthlyCapUsd: Math.min(100, Math.max(0, Number(input.monthlyCapUsd) || 0)),
    synthModel: modelIds.includes(input.synthModel) ? input.synthModel : d.synthModel,
    triageModel: modelIds.includes(input.triageModel) ? input.triageModel : d.triageModel,
    weekly: Boolean(input.weekly),
    geminiFreeTier: Boolean(input.geminiFreeTier),
  };
  await saveEdgeSettings(s);
  refresh();
  return s;
}

export async function toggleSourceAction(id: string, enabled: boolean) {
  await requireSession();
  await sql`update edge_sources set enabled = ${enabled} where id = ${id}`;
  refresh();
}

export async function addSourceAction(name: string, url: string) {
  await requireSession();
  const n = name.trim().slice(0, 80);
  const u = url.trim();
  if (!n || !isPublicUrl(u)) return { ok: false as const, error: "Give it a name and a public http(s) feed URL." };
  const id = `custom-${Date.now().toString(36)}`;
  await sql`insert into edge_sources (id, name, kind, url, source_type, custom) values (${id}, ${n}, 'rss', ${u}, 'news', true)`;
  const src = (await listSources()).find((s) => s.id === id)!;
  const r = await fromRss(src);
  refresh();
  return r.result.ok ? { ok: true as const } : { ok: false as const, error: `Added, but the check failed: ${r.result.error}. It stays listed so you can fix or remove it.` };
}

export async function removeSourceAction(id: string) {
  await requireSession();
  await sql`delete from edge_sources where id = ${id} and custom = true`;
  refresh();
}

/** Live check of every feed and channel (free: no search queries or AI calls) */
export async function checkSourcesAction() {
  await requireSession();
  const sources = (await listSources()).filter((s) => s.kind !== "search");
  await Promise.all(sources.map((s) => (s.kind === "rss" ? fromRss(s) : fromYouTube(s))));
  refresh();
}

export async function getEdgeSettingsAction() {
  await requireSession();
  return getEdgeSettings();
}
