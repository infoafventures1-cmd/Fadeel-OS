"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import type { TimetableSlot } from "@/lib/task-types";
import { GlassCard } from "@/components/ui/glass-card";
import { addTimetableSlotAction, deleteTimetableSlotAction } from "@/app/actions";
import { cn } from "@/lib/utils";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const KINDS = [
  ["class", "Class / fixed"],
  ["activity", "Activity"],
  ["break", "Break"],
  ["other", "Free period (can be planned over)"],
] as const;

const field =
  "rounded-lg border border-hairline bg-tint/[0.03] px-2.5 py-1.5 text-[12.5px] normal-case tracking-normal text-foreground focus:border-accent/50 focus:outline-none";
const label = "flex min-w-0 flex-col gap-1 text-[10.5px] uppercase tracking-wider text-muted-2";

export function TimetableEditor({ slots, today: initialDay }: { slots: TimetableSlot[]; today: number }) {
  const [day, setDay] = useState(initialDay);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const shown = slots.filter((s) => s.day === day);

  return (
    <GlassCard hover={false} className="p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {DAYS.map((name, i) => {
          const count = slots.filter((s) => s.day === i + 1).length;
          return (
            <button
              key={name}
              onClick={() => setDay(i + 1)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition",
                day === i + 1 ? "border-accent/40 bg-accent/15 text-accent" : "border-hairline bg-tint/[0.02] text-muted hover:text-foreground"
              )}
            >
              {name.slice(0, 3)} <span className="tabular text-muted-2">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="px-1 py-4 text-[13px] text-muted">Nothing on {DAYS[day - 1]} yet.</p>
      ) : (
        <div className="mb-1 divide-y divide-hairline">
          {shown.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <span className="w-[92px] shrink-0 font-mono text-[11.5px] tabular text-muted">
                {s.starts}–{s.ends}
              </span>
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.kind === "other" ? "bg-muted-2" : "bg-sky")} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">
                {s.title}
                {s.location && <span className="text-muted-2"> · {s.location}</span>}
              </span>
              <button
                aria-label={`Remove ${s.title}`}
                disabled={pending}
                onClick={() => start(() => deleteTimetableSlotAction(s.id))}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-2 hover:bg-tint/5 hover:text-rose"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={(f) => {
          const starts = String(f.get("starts"));
          const ends = String(f.get("ends"));
          if (starts >= ends) return setError("The end time has to be after the start time.");
          setError(null);
          f.set("day", String(day));
          start(async () => {
            await addTimetableSlotAction(f);
            formRef.current?.reset();
          });
        }}
        className="mt-3 grid grid-cols-2 items-end gap-2 border-t border-hairline pt-4 sm:grid-cols-[1.6fr_auto_auto_1fr_1fr_auto]"
      >
        <label className={cn(label, "col-span-2 sm:col-span-1")}>
          What
          <input name="title" required maxLength={80} placeholder="Maths" autoComplete="off" className={field} />
        </label>
        <label className={label}>
          From
          <input name="starts" type="time" required className={field} />
        </label>
        <label className={label}>
          To
          <input name="ends" type="time" required className={field} />
        </label>
        <label className={label}>
          Type
          <select name="kind" defaultValue="class" className={field}>
            {KINDS.map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Where (optional)
          <input name="location" maxLength={80} autoComplete="off" className={field} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="col-span-2 flex h-[34px] items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-medium text-white transition hover:bg-accent-dim disabled:opacity-60 sm:col-span-1"
        >
          <Plus size={13} /> {pending ? "Saving…" : `Add to ${DAYS[day - 1].slice(0, 3)}`}
        </button>
      </form>
      {error && <p className="mt-2 text-[12px] text-rose">{error}</p>}
    </GlassCard>
  );
}
