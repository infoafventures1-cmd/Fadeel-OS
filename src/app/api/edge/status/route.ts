import { requireSession } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";

// Polled by the Daily Edge page while a run is in progress
export const dynamic = "force-dynamic";

export async function GET() {
  await requireSession();
  const [j] = await sql`select id, status, stage, error, started_at, finished_at, log from edge_jobs order by started_at desc limit 1`;
  if (!j) return Response.json({ job: null });
  const log = (j.log as { at: string; msg: string }[]) ?? [];
  return Response.json({
    job: { id: String(j.id), status: String(j.status), stage: String(j.stage), error: (j.error as string) ?? null, startedAt: j.started_at, finishedAt: j.finished_at, last: log.slice(-4) },
  });
}
