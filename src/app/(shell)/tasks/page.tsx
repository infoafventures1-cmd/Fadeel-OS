import { listTasks } from "@/lib/server/data";
import { TaskBoard } from "@/components/tasks/task-board";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  return <TaskBoard tasks={await listTasks()} />;
}
