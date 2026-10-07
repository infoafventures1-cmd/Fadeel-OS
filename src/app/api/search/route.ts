import { listOpenTasks } from "@/lib/server/data";
import { listDocs } from "@/lib/server/docs";
import { listPlans } from "@/lib/server/plans";
import { projectByKey } from "@/config";

export const dynamic = "force-dynamic";

// Open tasks and documents for the ⌘K palette (the proxy already requires a session for /api/*)
export async function GET() {
  const [tasks, docs, plans] = await Promise.all([listOpenTasks(), listDocs(), listPlans()]);
  return Response.json({
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, project: projectByKey(t.project)?.name ?? t.project })),
    docs: docs.map((d) => ({ id: d.id, title: d.title })),
    plans: plans.map((p) => ({ id: p.id, title: p.title })),
  });
}
