// Spend tracking and the monthly cap. Every paid call (AI or search) checks the cap first and records itself after.
import { AI_MODELS } from "@/config";
import { DEFAULT_EDGE_SETTINGS, type EdgeSettings } from "@/lib/edge";
import { complete, type ChatMsg } from "../ai";
import { getSetting, setSetting } from "../data";
import { sql } from "../db";

/** US$ per million tokens [input, output]. Anthropic list prices (Oct 2026); others are rough estimates. */
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "claude-haiku-4-5-20251001": [1, 5],
};
const FALLBACK_PRICE: [number, number] = [5, 20];
/** Brave Search: about $5 per 1,000 requests (the first $5 each month is covered by Brave's free credit) */
export const SEARCH_COST = 0.005;

export class CapError extends Error {}

export async function getEdgeSettings(): Promise<EdgeSettings> {
  const s = await getSetting<Partial<EdgeSettings>>("edge_settings", {});
  return { ...DEFAULT_EDGE_SETTINGS, ...s, weights: { ...DEFAULT_EDGE_SETTINGS.weights, ...(s.weights ?? {}) } };
}

export async function saveEdgeSettings(s: EdgeSettings) {
  await setSetting("edge_settings", s);
}

export async function monthSpend() {
  const [row] = await sql`select coalesce(sum(cost_usd), 0)::float as usd, count(*)::int as calls
    from edge_usage where at >= date_trunc('month', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'`;
  return { usd: Number(row?.usd ?? 0), calls: Number(row?.calls ?? 0) };
}

export async function assertBudget(projectedUsd: number) {
  const [{ usd }, s] = await Promise.all([monthSpend(), getEdgeSettings()]);
  if (usd + projectedUsd > s.monthlyCapUsd) {
    throw new CapError(`Monthly spending cap reached ($${usd.toFixed(2)} of $${s.monthlyCapUsd.toFixed(2)}). Raise it in Settings › Daily Edge or wait for next month.`);
  }
}

export async function recordUsage(u: { provider: string; purpose: string; units?: number; input?: number; output?: number; costUsd: number; jobId?: string | null }) {
  await sql`insert into edge_usage (provider, purpose, units, input_tokens, output_tokens, cost_usd, job_id)
    values (${u.provider}, ${u.purpose}, ${u.units ?? 1}, ${u.input ?? 0}, ${u.output ?? 0}, ${u.costUsd}, ${u.jobId ?? null})`;
  if (u.jobId) await sql`update edge_jobs set cost_usd = cost_usd + ${u.costUsd} where id = ${u.jobId}`;
}

export function aiCost(modelId: string, input: number, output: number) {
  const m = AI_MODELS.find((x) => x.id === modelId);
  const [pi, po] = (m && PRICES[m.model]) || FALLBACK_PRICE;
  return (input * pi + output * po) / 1_000_000;
}

/** An AI call with the cap checked before and the cost recorded after. Estimates input from length when the provider doesn't report it. */
export async function meteredComplete(modelId: string, purpose: string, system: string, messages: ChatMsg[], opts: { maxTokens: number; jobId?: string | null }) {
  const approxIn = Math.ceil((system.length + messages.reduce((n, m) => n + m.content.length, 0)) / 3.5);
  await assertBudget(aiCost(modelId, approxIn, opts.maxTokens));
  const r = await complete(modelId, system, messages, { maxTokens: opts.maxTokens });
  const input = r.usage.input || approxIn;
  const output = r.usage.output || Math.ceil(r.text.length / 3.5);
  await recordUsage({ provider: `ai:${modelId}`, purpose, input, output, costUsd: aiCost(modelId, input, output), jobId: opts.jobId });
  return r;
}

export async function usageSummary() {
  const [month, byPurpose, jobs] = await Promise.all([
    monthSpend(),
    sql`select purpose, count(*)::int as calls, coalesce(sum(cost_usd),0)::float as usd from edge_usage
        where at >= now() - interval '30 days' group by purpose order by usd desc`,
    sql`select id, kind, day::text as day, trigger, status, stage, error, cost_usd::float as cost, attempts, started_at, finished_at, log
        from edge_jobs order by started_at desc limit 12`,
  ]);
  return {
    month,
    byPurpose: byPurpose.map((r) => ({ purpose: String(r.purpose), calls: Number(r.calls), usd: Number(r.usd) })),
    jobs: jobs.map((j) => ({
      id: String(j.id),
      kind: String(j.kind),
      day: String(j.day),
      trigger: String(j.trigger),
      status: String(j.status),
      stage: String(j.stage),
      error: (j.error as string) ?? null,
      cost: Number(j.cost),
      attempts: Number(j.attempts),
      startedAt: new Date(j.started_at as string).toISOString(),
      finishedAt: j.finished_at ? new Date(j.finished_at as string).toISOString() : null,
      log: (j.log as { at: string; msg: string }[]) ?? [],
    })),
  };
}
