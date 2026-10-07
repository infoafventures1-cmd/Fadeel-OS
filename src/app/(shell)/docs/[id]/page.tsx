import { notFound } from "next/navigation";
import { DocEditor } from "@/components/docs/doc-editor";
import { getDoc } from "@/lib/server/docs";
import { modelStatus } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDoc(id);
  if (!doc) notFound();
  return <DocEditor doc={doc} models={modelStatus()} />;
}
