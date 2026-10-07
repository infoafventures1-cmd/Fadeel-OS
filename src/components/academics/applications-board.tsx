"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronDown, GraduationCap, Plus, Trash2, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import {
  createApplicationAction,
  deleteApplicationAction,
  saveApplicationStepsAction,
  updateApplicationAction,
} from "@/app/academics-actions";
import { TIERS, dayMonth, daysUntilDay, stepId, type AppStep, type Application, type Tier } from "@/lib/academics";
import { cn } from "@/lib/utils";
import { fieldClass } from "./topic-status";

const TIER_STYLE: Record<Tier, string> = {
  safety: "border-emerald/30 bg-emerald/10 text-emerald",
  target: "border-sky/30 bg-sky/10 text-sky",
  reach: "border-rose/30 bg-rose/10 text-rose",
};

const started = (a: Application) => a.steps.some((s) => s.done);
const submitted = (a: Application) => a.steps.length > 0 && a.steps.every((s) => s.done);

function daysLeft(day: string) {
  const n = daysUntilDay(day);
  if (n < 0) return { label: `${-n}d ago`, className: "text-muted-2" };
  if (n === 0) return { label: "today", className: "text-rose" };
  return { label: `${n}d left`, className: n <= 14 ? "text-amber" : "text-muted" };
}

export function ApplicationsBoard({ applications }: { applications: Application[] }) {
  const [region, setRegion] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const regions: { name: string; count: number }[] = [];
  for (const a of applications) {
    const r = regions.find((x) => x.name === a.region);
    if (r) r.count++;
    else regions.push({ name: a.region, count: 1 });
  }
  const shown = region ? applications.filter((a) => a.region === region) : applications;
  const groups = regions.filter((r) => !region || r.name === region);
  const next = applications.find((a) => a.deadline && daysUntilDay(a.deadline) >= 0 && !submitted(a));

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-semibold leading-none">
            Applications, <em>in order</em>.
          </h1>
          <p className="mt-2.5 text-[14px] text-muted">Sorted by deadline. Open a university to tick off its steps, set your own deadline and keep notes.</p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-accent-dim"
        >
          <Plus size={14} /> Add university
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <GlassCard hover={false} className="p-5">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Next deadline</p>
          {next?.deadline ? (
            <>
              <p className="mt-2.5 truncate text-[17px] font-semibold">{next.university}</p>
              <p className="mt-1 text-[13.5px] text-muted">
                {dayMonth(next.deadline)} · <span className={daysLeft(next.deadline).className}>{daysLeft(next.deadline).label}</span>
              </p>
            </>
          ) : (
            <p className="mt-2.5 text-[13.5px] text-muted">No upcoming deadlines</p>
          )}
        </GlassCard>
        <GlassCard hover={false} className="p-5">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Started</p>
          <p className="tabular mt-2.5 text-[30px] font-semibold leading-none">
            {applications.filter(started).length} <span className="text-[17px] font-normal text-muted-2">/ {applications.length}</span>
          </p>
        </GlassCard>
        <GlassCard hover={false} className="p-5">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Submitted</p>
          <p className="tabular mt-2.5 text-[30px] font-semibold leading-none">
            {applications.filter(submitted).length} <span className="text-[17px] font-normal text-muted-2">/ {applications.length}</span>
          </p>
        </GlassCard>
      </div>

      {adding && <AddApplicationForm regions={regions.map((r) => r.name)} onDone={() => setAdding(false)} />}

      {applications.length === 0 && !adding ? (
        <GlassCard hover={false} className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <GraduationCap size={22} className="text-muted-2" />
          <p className="text-[13px] text-muted">No universities yet. Press Add university to start your list.</p>
        </GlassCard>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <Chip active={region === null} onClick={() => setRegion(null)} label="All" count={applications.length} />
            {regions.map((r) => (
              <Chip key={r.name} active={region === r.name} onClick={() => setRegion(r.name)} label={r.name} count={r.count} />
            ))}
          </div>

          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.name}>
                <p className="mb-2.5 text-[14px] font-semibold">
                  {g.name} <span className="ml-1 font-normal text-muted-2">{g.count}</span>
                </p>
                <div className="space-y-3">
                  {shown
                    .filter((a) => a.region === g.name)
                    .map((a) => (
                      <ApplicationRow key={a.id} app={a} regions={regions.map((r) => r.name)} />
                    ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3.5 py-2 text-[13.5px] transition",
        active ? "border-accent/30 bg-accent/10 text-accent" : "border-hairline bg-tint/[0.03] text-muted hover:text-foreground"
      )}
    >
      {label} <span className={active ? "opacity-70" : "text-muted-2"}>{count}</span>
    </button>
  );
}

function ApplicationFields({ app, regions }: { app?: Application; regions: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input name="university" required defaultValue={app?.university} placeholder="University, e.g. York University" className={fieldClass} />
      <input name="program" defaultValue={app?.program} placeholder="Programme, e.g. Commerce (BCom)" className={fieldClass} />
      <input name="code" defaultValue={app?.code} placeholder="Application code, e.g. OUAC YFB" className={fieldClass} />
      <input name="region" list="app-regions" defaultValue={app?.region ?? regions[0] ?? ""} placeholder="Country or group, e.g. Canada" className={fieldClass} />
      <datalist id="app-regions">
        {regions.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <select name="tier" defaultValue={app?.tier ?? "target"} className={fieldClass}>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {t[0].toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
      <input name="deadline" type="date" defaultValue={app?.deadline ?? ""} aria-label="Deadline" className={fieldClass} />
    </div>
  );
}

const readFields = (f: FormData) => ({
  university: String(f.get("university") ?? ""),
  program: String(f.get("program") ?? ""),
  code: String(f.get("code") ?? ""),
  region: String(f.get("region") ?? ""),
  tier: String(f.get("tier") ?? "target"),
  deadline: String(f.get("deadline") ?? "") || null,
});

function AddApplicationForm({ regions, onDone }: { regions: string[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <GlassCard hover={false} className="mb-6 p-5">
      <p className="mb-3 text-[15px] font-semibold">Add a university</p>
      <form
        action={(f) =>
          start(async () => {
            await createApplicationAction(readFields(f));
            onDone();
          })
        }
        className="space-y-3"
      >
        <ApplicationFields regions={regions} />
        <p className="text-[12px] text-muted-2">It starts with a standard checklist of steps. You can rename, remove or add steps once it is open.</p>
        <div className="flex gap-2">
          <button disabled={pending} className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-accent-dim disabled:opacity-60">
            Add university
          </button>
          <button type="button" onClick={onDone} className="rounded-lg border border-hairline px-3 py-2 text-[12.5px] text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </form>
    </GlassCard>
  );
}

function ApplicationRow({ app, regions }: { app: Application; regions: string[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [steps, setSteps] = useOptimistic(app.steps);
  const [newStep, setNewStep] = useState("");
  const [notes, setNotes] = useState(app.notes);
  const done = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;

  const saveSteps = (next: AppStep[]) =>
    start(async () => {
      setSteps(next);
      await saveApplicationStepsAction(app.id, next);
    });

  return (
    <GlassCard hover={false} className="overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        <ChevronDown size={16} className={cn("shrink-0 text-muted-2 transition", open && "rotate-180")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold text-foreground">{app.university}</span>
            <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider", TIER_STYLE[app.tier])}>{app.tier}</span>
          </div>
          <p className="mt-1 truncate text-[13.5px] text-muted">{[app.program, app.code].filter(Boolean).join(" · ") || "Programme not set"}</p>
        </div>
        <div className="hidden w-[150px] shrink-0 text-right sm:block">
          <p className="text-[12.5px] text-muted">
            {app.deadline ? (
              <>
                {dayMonth(app.deadline)} · <span className={daysLeft(app.deadline).className}>{daysLeft(app.deadline).label}</span>
              </>
            ) : (
              "No deadline"
            )}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint/[0.08]" title={`${done} of ${steps.length} steps done`}>
            <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald" : "bg-accent")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-hairline px-5 pb-5 pt-4 sm:pl-[52px]">
          {editing ? (
            <form
              action={(f) =>
                start(async () => {
                  await updateApplicationAction(app.id, readFields(f));
                  setEditing(false);
                })
              }
              className="space-y-3"
            >
              <ApplicationFields app={app} regions={regions} />
              <div className="flex items-center gap-2">
                <button disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim disabled:opacity-60">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove ${app.university} from your list?`)) start(() => deleteApplicationAction(app.id));
                  }}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-muted-2 hover:text-rose"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </form>
          ) : (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                  Steps <span className="tabular ml-1 font-normal normal-case tracking-normal text-muted-2">{done}/{steps.length}</span>
                </p>
                <div className="space-y-0.5">
                  {steps.map((s) => (
                    <div key={s.id} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-tint/[0.03]">
                      <button
                        role="checkbox"
                        aria-checked={s.done}
                        aria-label={s.title}
                        onClick={() => saveSteps(steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                        className={cn(
                          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition",
                          s.done ? "border-emerald bg-emerald text-white" : "border-hairline-strong hover:border-accent"
                        )}
                      >
                        {s.done && <Check size={12} strokeWidth={3} />}
                      </button>
                      <span className={cn("min-w-0 flex-1 text-[13.5px]", s.done ? "text-muted line-through" : "text-foreground")}>{s.title}</span>
                      <button
                        aria-label={`Remove step ${s.title}`}
                        onClick={() => saveSteps(steps.filter((x) => x.id !== s.id))}
                        className="text-muted-2 opacity-0 transition hover:text-rose focus:opacity-100 group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  action={() => {
                    const title = newStep.trim();
                    if (!title) return;
                    setNewStep("");
                    saveSteps([...steps, { id: stepId(), title, done: false }]);
                  }}
                  className="mt-2 flex gap-2"
                >
                  <input value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="Add a step" className={cn(fieldClass, "min-w-0 flex-1 py-1.5")} />
                  <button disabled={!newStep.trim()} className="rounded-lg border border-hairline px-3 text-[12px] text-muted hover:text-foreground disabled:opacity-50">
                    Add
                  </button>
                </form>
              </div>

              <div className="min-w-0 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[11.5px] font-semibold uppercase tracking-wider text-muted">Your deadline</span>
                  <input
                    type="date"
                    defaultValue={app.deadline ?? ""}
                    onChange={(e) => start(() => updateApplicationAction(app.id, { deadline: e.target.value || null }))}
                    className={cn(fieldClass, "w-full")}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11.5px] font-semibold uppercase tracking-wider text-muted">Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => notes !== app.notes && start(() => updateApplicationAction(app.id, { notes }))}
                    rows={5}
                    placeholder="Essay prompts, portal logins to remember, who is writing your reference…"
                    className={cn(fieldClass, "w-full resize-y leading-relaxed")}
                  />
                  <span className="mt-1 block text-[11px] text-muted-2">{pending ? "Saving…" : "Saves when you click away."}</span>
                </label>
                <button onClick={() => setEditing(true)} className="text-[12.5px] text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Edit name, programme, region or tier
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
