import { NotesBoard } from "@/components/academics/notes-board";
import { listNotes, listSubjects } from "@/lib/server/academics";

export const dynamic = "force-dynamic";

export default async function AcademicNotesPage() {
  const [notes, subjects] = await Promise.all([listNotes(), listSubjects()]);
  return <NotesBoard notes={notes} subjects={subjects.map(({ id, name, color }) => ({ id, name, color }))} />;
}
