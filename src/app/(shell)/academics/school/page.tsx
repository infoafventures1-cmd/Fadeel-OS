import { SchoolBoard } from "@/components/academics/school-board";
import { listSubjects } from "@/lib/server/academics";

export const dynamic = "force-dynamic";

export default async function SchoolPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const [subjects, { s }] = await Promise.all([listSubjects(), searchParams]);
  return <SchoolBoard subjects={subjects} initialId={s} />;
}
