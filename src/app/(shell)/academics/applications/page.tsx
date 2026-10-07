import { ApplicationsBoard } from "@/components/academics/applications-board";
import { listApplications } from "@/lib/server/academics";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  return <ApplicationsBoard applications={await listApplications()} />;
}
