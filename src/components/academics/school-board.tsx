"use client";

import { useState, useTransition } from "react";
import { BookOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import {
  addTopicAction,
  createSubjectAction,
  deleteSubjectAction,
  deleteTopicAction,
  updateSubjectAction,
} from "@/app/academics-actions";
import { LEVELS, SUBJECT_COLORS, dayMonth, shortUntil, daysUntilDay, type Subject } from "@/lib/academics";
import { cn } from "@/lib/utils";
import { TopicStatusPicker, fieldClass } from "./topic-status";

export function SchoolBoard({ subjects, initialId }: { subjects: Subject[]; initialId?: string }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId ?? subjects[0]?.id);
  const [adding, setAdding] = useState(subjects.length === 0);
  const selected = subjects.find((s) => s.id === selectedId) ?? subjects[0];

  return (
    <div className="mx-auto max-w-[1180px]">
      <h1 className="mb-6 text-[30px] font-semibold leading-none">
        School <em>OS</em>
      </h1>

      <div className="scrollbar-thin -mx-1 mb-6 flex gap-3 overflow-x-auto px-1 pb-2">
        {subjects.map((s) => {
          const active = s.id === selected?.id;
          return (
            <button
              key={s.id}
              onClick={() => {
                setSelectedId(s.id);
                setAdding(false);
              }}
              className={cn(
                "flex h-[88px] w-[168px] shrink-0 flex-col justify-center rounded-xl border px-4 text-left transition",
                active ? "border-accent/30 bg-accent/10" : "border-hairline bg-tint/[0.03] hover:border-hairline-strong"
              )}
            >
              <span className="truncate text-[14.5px] font-semibold text-foreground">{s.name}</span>
              <span className="mt-1 text-[12px] text-muted-2">{s.level}</span>
            </button>
          );
        })}
        <button
          onClick={() => setAdding((v) => !v)}
          className={cn(
            "flex h-[88px] w-[140px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[12.5px] transition",
            adding ? "border-accent/40 text-accent" : "border-hairline-strong text-muted hover:text-foreground"
          )}
        >
          <Plus size={16} /> Add subject
        </button>
      </div>

      {adding && (
        <AddSubjectForm
          first={subjects.length === 0}
          onDone={(id) => {
            setAdding(false);
            if (id) setSelectedId(id);
          }}
        />
      )}

      {selected && !adding && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <SubjectCard key={selected.id} subject={selected} onDeleted={() => setSelectedId(undefined)} />
          <div className="flex flex-col gap-5">
            <GradesCard key={`g-${selected.id}`} subject={selected} />
            <NextAssessmentCard key={`n-${selected.id}`} subject={selected} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddSubjectForm({ onDone, first }: { onDone: (id: string | null) => void; first: boolean }) {
  const [pending, start] = useTransition();
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  return (
    <GlassCard hover={false} className="p-5">
      <p className="text-[15px] font-semibold">{first ? "Add your first subject" : "New subject"}</p>
      <p className="mt-1 text-[12.5px] text-muted">For example Math AI HL, Economics HL, TOK or the Extended Essay.</p>
      <form
        action={(f) =>
          start(async () => {
            const id = await createSubjectAction({ name: String(f.get("name") ?? ""), level: String(f.get("level") ?? "SL"), color });
            onDone(id);
          })
        }
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <input name="name" required autoFocus placeholder="Subject name" className={cn(fieldClass, "min-w-0 flex-[1_1_220px]")} />
        <select name="level" defaultValue="HL" className={fieldClass}>
          {LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <ColorPicker value={color} onChange={setColor} />
        <button disabled={pending} className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-accent-dim disabled:opacity-60">
          <Plus size={14} /> Add subject
        </button>
        {!first && (
          <button type="button" onClick={() => onDone(null)} className="rounded-lg border border-hairline px-3 py-2 text-[12.5px] text-muted hover:text-foreground">
            Cancel
          </button>
        )}
      </form>
    </GlassCard>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Colour">
      {SUBJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn("h-5 w-5 rounded-full border-2 transition", value === c ? "border-foreground" : "border-transparent")}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function SubjectCard({ subject, onDeleted }: { subject: Subject; onDeleted: () => void }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [color, setColor] = useState(subject.color);
  const [topic, setTopic] = useState("");

  return (
    <GlassCard hover={false} className="min-w-0 p-6">
      {editing ? (
        <form
          action={(f) =>
            start(async () => {
              await updateSubjectAction(subject.id, { name: String(f.get("name") ?? ""), level: String(f.get("level") ?? ""), color });
              setEditing(false);
            })
          }
          className="mb-5 flex flex-wrap items-center gap-2"
        >
          <input name="name" defaultValue={subject.name} required className={cn(fieldClass, "min-w-0 flex-[1_1_200px]")} />
          <select name="level" defaultValue={subject.level} className={fieldClass}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <ColorPicker value={color} onChange={setColor} />
          <button disabled={pending} className="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white hover:bg-accent-dim disabled:opacity-60">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-hairline px-3 py-2 text-[12px] text-muted hover:text-foreground">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete ${subject.name} and all its topics?`))
                start(async () => {
                  await deleteSubjectAction(subject.id);
                  onDeleted();
                });
            }}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-2 text-[12px] text-muted-2 hover:text-rose"
          >
            <Trash2 size={12} /> Delete subject
          </button>
        </form>
      ) : (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold">{subject.name}</h2>
            <p className="mt-1 text-[14.5px] text-muted">{subject.nextAssessment ? `Next: ${subject.nextAssessment}` : "No assessment set yet"}</p>
          </div>
          <button onClick={() => setEditing(true)} aria-label="Edit subject" className="rounded-lg p-2 text-muted-2 hover:bg-tint/[0.04] hover:text-foreground">
            <Pencil size={14} />
          </button>
        </div>
      )}

      <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wider text-muted">Revision topics</p>
      <div className="space-y-2.5">
        {subject.topics.map((t) => (
          <div key={t.id} className="group flex items-center gap-3 rounded-lg border border-hairline bg-tint/[0.02] px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-[14.5px] text-foreground">{t.title}</p>
            <TopicStatusPicker id={t.id} status={t.status} />
            <button
              aria-label={`Remove ${t.title}`}
              onClick={() => start(() => deleteTopicAction(t.id))}
              className="text-muted-2 opacity-0 transition hover:text-rose focus:opacity-100 group-hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {subject.topics.length === 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-hairline-strong px-4 py-3 text-[13px] text-muted">
            <BookOpen size={14} /> No topics yet. Add the units you need to revise below.
          </p>
        )}
      </div>

      <form
        action={() =>
          start(async () => {
            const title = topic.trim();
            if (!title) return;
            setTopic("");
            await addTopicAction(subject.id, title);
          })
        }
        className="mt-3 flex gap-2"
      >
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Add a topic, e.g. Calculus: optimisation" className={cn(fieldClass, "min-w-0 flex-1")} />
        <button disabled={pending || !topic.trim()} className="flex items-center gap-1 rounded-lg border border-hairline px-3 py-2 text-[12.5px] text-muted transition hover:text-foreground disabled:opacity-50">
          <Plus size={13} /> Add
        </button>
      </form>
    </GlassCard>
  );
}

function GradesCard({ subject }: { subject: Subject }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  return (
    <GlassCard hover={false} className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Grades</p>
        {!editing && (
          <button onClick={() => setEditing(true)} aria-label="Edit grades" className="text-muted-2 hover:text-foreground">
            <Pencil size={12} />
          </button>
        )}
      </div>
      {editing ? (
        <form
          action={(f) =>
            start(async () => {
              await updateSubjectAction(subject.id, { currentGrade: String(f.get("current") ?? ""), predictedGrade: String(f.get("predicted") ?? "") });
              setEditing(false);
            })
          }
          className="space-y-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px] text-muted">
              Current
              <input name="current" defaultValue={subject.currentGrade} placeholder="6" className={cn(fieldClass, "mt-1 w-full")} />
            </label>
            <label className="text-[12px] text-muted">
              Predicted
              <input name="predicted" defaultValue={subject.predictedGrade} placeholder="7" className={cn(fieldClass, "mt-1 w-full")} />
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-muted">Current</p>
            <p className="tabular mt-1 text-[30px] font-semibold leading-none text-foreground">{subject.currentGrade || "–"}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-muted">Predicted</p>
            <p className="tabular mt-1 text-[30px] font-semibold leading-none text-emerald">{subject.predictedGrade || "–"}</p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function NextAssessmentCard({ subject }: { subject: Subject }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const date = subject.nextAssessmentDate;
  const soon = date !== null && daysUntilDay(date) <= 7;
  return (
    <GlassCard hover={false} className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Next assessment</p>
        {!editing && (
          <button onClick={() => setEditing(true)} aria-label="Edit next assessment" className="text-muted-2 hover:text-foreground">
            <Pencil size={12} />
          </button>
        )}
      </div>
      {editing ? (
        <form
          action={(f) =>
            start(async () => {
              await updateSubjectAction(subject.id, { nextAssessment: String(f.get("what") ?? ""), nextAssessmentDate: String(f.get("date") ?? "") || null });
              setEditing(false);
            })
          }
          className="space-y-2"
        >
          <input name="what" defaultValue={subject.nextAssessment} placeholder="Paper 2 mock" className={cn(fieldClass, "w-full")} />
          <input name="date" type="date" defaultValue={date ?? ""} className={cn(fieldClass, "w-full")} />
          <p className="text-[11.5px] text-muted-2">With a date set, this subject also shows on the Exams page.</p>
          <div className="flex gap-2">
            <button disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </form>
      ) : subject.nextAssessment || date ? (
        <>
          <p className="text-[15px] text-foreground">{subject.nextAssessment || "Assessment"}</p>
          {date && (
            <p className={cn("mt-1.5 text-[13px]", soon ? "text-accent" : "text-muted")}>
              {shortUntil(date)} <span className="text-muted-2">· {dayMonth(date)}</span>
            </p>
          )}
        </>
      ) : (
        <button onClick={() => setEditing(true)} className="text-[13px] text-muted hover:text-foreground">
          Set the next test, mock or deadline
        </button>
      )}
    </GlassCard>
  );
}
