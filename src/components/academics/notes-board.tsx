"use client";

import { useState, useTransition } from "react";
import { Lightbulb, NotebookPen, Plus, School, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "@/app/academics-actions";
import type { AcademicNote, Subject } from "@/lib/academics";
import { TZ } from "@/lib/time";
import { cn } from "@/lib/utils";
import { fieldClass } from "./topic-status";

type SubjectLite = Pick<Subject, "id" | "name" | "color">;

export function NotesBoard({ notes, subjects }: { notes: AcademicNote[]; subjects: SubjectLite[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[30px] font-semibold leading-none">
          Academic <em>notes</em>
        </h1>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-accent-dim"
        >
          <Plus size={14} /> New note
        </button>
      </div>

      {adding && (
        <GlassCard hover={false} className="mb-6 p-5">
          <NoteForm subjects={subjects} onDone={() => setAdding(false)} />
        </GlassCard>
      )}

      {notes.length === 0 && !adding ? (
        <GlassCard hover={false} className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <NotebookPen size={22} className="text-muted-2" />
          <p className="text-[13px] text-muted">No notes yet. Revision priorities, essay outlines, things a teacher said: press New note.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.map((n) => {
            const subject = subjects.find((s) => s.id === n.subjectId);
            if (editingId === n.id)
              return (
                <GlassCard key={n.id} hover={false} className="p-5 sm:col-span-2">
                  <NoteForm note={n} subjects={subjects} onDone={() => setEditingId(null)} />
                </GlassCard>
              );
            const Icon = subject ? School : Lightbulb;
            return (
              <button key={n.id} onClick={() => setEditingId(n.id)} className="text-left">
                <GlassCard className="flex h-full flex-col p-5">
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className="shrink-0 text-muted" />
                    <p className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-foreground">{n.title}</p>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? "var(--rose)" }} title={subject?.name ?? "General"} />
                  </div>
                  <p className="mt-2.5 line-clamp-4 flex-1 whitespace-pre-line text-[14px] leading-relaxed text-muted">{n.body || "Empty"}</p>
                  <p className="mt-4 text-[12.5px] text-muted-2">
                    {new Date(n.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ })}
                    {subject ? ` · ${subject.name}` : ""}
                  </p>
                </GlassCard>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NoteForm({ note, subjects, onDone }: { note?: AcademicNote; subjects: SubjectLite[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(f) =>
        start(async () => {
          const input = { title: String(f.get("title") ?? ""), body: String(f.get("body") ?? ""), subjectId: String(f.get("subject") ?? "") || null };
          if (note) await updateNoteAction(note.id, input);
          else await createNoteAction(input);
          onDone();
        })
      }
      className="space-y-2.5"
    >
      <div className="flex flex-wrap gap-2">
        <input name="title" required autoFocus defaultValue={note?.title} placeholder="Title, e.g. ESS revision priorities" className={cn(fieldClass, "min-w-0 flex-[1_1_240px]")} />
        <select name="subject" defaultValue={note?.subjectId ?? ""} className={fieldClass} aria-label="Subject">
          <option value="">General</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <textarea name="body" defaultValue={note?.body} rows={6} placeholder="Write the note…" className={cn(fieldClass, "w-full resize-y leading-relaxed")} />
      <div className="flex items-center gap-2">
        <button disabled={pending} className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-accent-dim disabled:opacity-60">
          {note ? "Save" : "Add note"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-hairline px-3 py-2 text-[12.5px] text-muted hover:text-foreground">
          Cancel
        </button>
        {note && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete “${note.title}”?`))
                start(async () => {
                  await deleteNoteAction(note.id);
                  onDone();
                });
            }}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-2 text-[12px] text-muted-2 hover:text-rose"
          >
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>
    </form>
  );
}
