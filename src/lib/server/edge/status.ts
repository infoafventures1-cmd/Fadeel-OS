// Which integrations are configured. Only booleans leave the server; the keys themselves never do.
import { modelReady } from "../ai";
import { sql } from "../db";
import { hasSearchKey, hasYouTubeKey } from "./discover";
import { getEdgeSettings } from "./usage";

export async function edgeCredentials() {
  const s = await getEdgeSettings();
  return {
    ai: modelReady(s.synthModel),
    triage: modelReady(s.triageModel),
    search: hasSearchKey(),
    youtube: hasYouTubeKey(),
    cron: (process.env.CRON_SECRET ?? "").trim().length >= 16,
  };
}
export type EdgeCredentials = Awaited<ReturnType<typeof edgeCredentials>>;

export async function latestJob() {
  const [j] = await sql`select status, stage, error, started_at, finished_at, day::text as day from edge_jobs order by started_at desc limit 1`;
  return j
    ? { status: String(j.status), stage: String(j.stage), error: (j.error as string) ?? null, startedAt: new Date(j.started_at as string).toISOString(), day: String(j.day) }
    : null;
}
