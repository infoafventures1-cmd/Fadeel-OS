import { safeEqual } from "@/lib/server/session";
import { acquire, runJob, runWeekly } from "@/lib/server/edge/pipeline";
import { getEdgeSettings } from "@/lib/server/edge/usage";
import { isoWeekday, localDate } from "@/lib/time";

// Daily Edge scheduler endpoint, called by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; without a matching secret nothing runs.
export const dynamic = "force-dynamic";
// Vercel Hobby allows up to 300 s per invocation. The run stops itself at about 270 s and resumes on the next trigger.
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret.length < 16) return Response.json({ error: "CRON_SECRET is not set (16+ characters), so scheduled runs are disabled." }, { status: 503 });
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const force = new URL(req.url).searchParams.get("force") === "1";
  const started = await acquire("cron", { force });
  if (started.status === "started" || started.status === "resumed") await runJob(started.jobId, 270_000);

  // Optional weekly synthesis on Sundays, once the daily run is done
  let weekly: unknown = null;
  const settings = await getEdgeSettings();
  if (settings.weekly && isoWeekday(localDate()) === 7) {
    try {
      weekly = await runWeekly(false);
    } catch (e) {
      weekly = { ok: false, error: e instanceof Error ? e.message : "failed" };
    }
  }
  return Response.json({ daily: started, weekly });
}
