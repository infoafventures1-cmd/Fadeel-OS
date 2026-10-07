import { notFound } from "next/navigation";
import { PlanEditor } from "@/components/plans/plan-editor";
import { getPlan } from "@/lib/server/plans";
import { modelStatus } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  return <PlanEditor plan={plan} models={modelStatus()} />;
}
