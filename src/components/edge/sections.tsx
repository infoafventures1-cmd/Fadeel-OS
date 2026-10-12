"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, BookOpen, Check, Clock, Loader2, PlayCircle, RefreshCw, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { refreshEdgeAction, reviewAction, weeklyAction } from "@/app/edge-actions";
import type { BriefingData, Concept, EdgeItem, WeeklyData } from "@/lib/edge";
import { cn } from "@/lib/utils";
import { AccessBadge, SourceLine } from "./meta";
import { ItemActions, TakeawayBox } from "./item-actions";
import { LearnTools } from "./story-card";

export const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-[11px] font-semibold uppercase tracking-wider text-muted", className)}>{children}</p>
);

/* ---------------- concept ---------------- */

export function ConceptCard({ concept, day }: { concept: Concept; day: string }) {
  return (
    <GlassCard hover={false} className="p-5 sm:p-6">
      <Label>Concept of the day</Label>
      <h3 className="mt-1.5 text-[18px] font-semibold">{concept.title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground">{concept.plain}</p>

      {concept.diagram && (
        <figure className="mt-5">
          <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
            {concept.diagram.nodes.map((node, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 sm:flex-row">
                <div className="w-full rounded-xl border border-accent/25 bg-accent/[0.06] px-3.5 py-2.5 text-center text-[13px] font-medium text-foreground sm:w-auto sm:max-w-[200px]">{node}</div>
                {i < concept.diagram!.nodes.length - 1 && (
                  <>
                    <ArrowDown size={16} className="text-accent sm:hidden" />
                    <ArrowRight size={16} className="hidden shrink-0 text-accent sm:block" />
                  </>
                )}
              </div>
            ))}
          </div>
          {concept.diagram.caption && <figcaption className="mt-2 text-[12px] text-muted-2">{concept.diagram.caption}</figcaption>}
        </figure>
      )}

      <div className="mt-5 rounded-xl border border-hairline bg-tint/[0.02] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Worked example</Label>
          <span className="rounded-md border border-hairline px-1.5 py-0.5 text-[10.5px] text-muted-2">Illustrative numbers, not from today&apos;s sources</span>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-foreground">{concept.example.setup}</p>
        <ol className="mt-3 space-y-1.5">
          {concept.example.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
              <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tint/[0.07] font-mono text-[10.5px] text-muted">{i + 1}</span>
              <span className="tabular text-foreground">{s}</span>
            </li>
          ))}
        </ol>
        {concept.example.result && (
          <p className="mt-3 border-t border-hairline pt-3 text-[13.5px] font-medium text-foreground">
            <span className="text-accent">So: </span>
            {concept.example.result}
          </p>
        )}
      </div>
      <div className="mt-4">
        <LearnTools itemId={null} summary="" recall={concept.recall} day={day} kind="concept" />
      </div>
    </GlassCard>
  );
}

/* ---------------- deep read & video ---------------- */

export function DeepReadCard({ item, why, minutes, optional }: { item: EdgeItem; why: string; minutes: number; optional: boolean }) {
  return (
    <GlassCard hover={false} className="p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label className="mr-1">Read in depth</Label>
        <span className="inline-flex items-center gap-1 rounded-md border border-hairline px-1.5 py-0.5 text-[10.5px] text-muted">
          <Clock size={10} /> {minutes} min
        </span>
        {optional && <span className="rounded-md bg-tint/[0.06] px-1.5 py-0.5 text-[10.5px] font-medium text-muted">Optional</span>}
        <AccessBadge access={item.access} />
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="group mt-2 block">
        <h3 className="flex items-start gap-2 text-[16px] font-semibold leading-snug group-hover:text-accent">
          <BookOpen size={16} className="mt-0.5 shrink-0 text-muted-2" />
          {item.title}
        </h3>
      </a>
      <div className="mt-1.5">
        <SourceLine item={item} />
      </div>
      {why && <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{why}</p>}
      <div className="mt-4 space-y-3">
        <ItemActions id={item.id} saved={Boolean(item.savedAt)} read={Boolean(item.readAt)} />
        <TakeawayBox id={item.id} initial={item.takeaway} />
      </div>
    </GlassCard>
  );
}

export function VideoCard({ item, why, optional }: { item: EdgeItem; why: string; optional: boolean }) {
  const [more, setMore] = useState(false);
  const [thumbOk, setThumbOk] = useState(true);
  return (
    <GlassCard hover={false} className="p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label className="mr-1">Watch</Label>
        <span className="inline-flex items-center gap-1 rounded-md border border-hairline px-1.5 py-0.5 text-[10.5px] text-muted">
          <Clock size={10} /> {item.durationMin ? `${item.durationMin} min` : "length unknown"}
        </span>
        {optional && <span className="rounded-md bg-tint/[0.06] px-1.5 py-0.5 text-[10.5px] font-medium text-muted">Optional</span>}
        <AccessBadge access="video" />
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        {item.thumbnail && thumbOk && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="relative block shrink-0 overflow-hidden rounded-xl sm:w-[220px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbnail} alt="" onError={() => setThumbOk(false)} className="aspect-video w-full object-cover" />
            <PlayCircle size={34} className="absolute inset-0 m-auto text-white drop-shadow" />
          </a>
        )}
        <div className="min-w-0">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[15.5px] font-semibold leading-snug hover:text-accent">
            {item.title}
          </a>
          <p className="mt-1 text-[12px] text-muted-2">{item.channel ?? item.publisher}</p>
          {why && <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{why}</p>}
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-tint/[0.03] px-3 py-2.5">
        <p className="text-[11px] font-semibold text-muted">Preview from the video&apos;s description (no transcript was available, so the video itself wasn&apos;t summarised)</p>
        <p className={cn("mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-muted", !more && "line-clamp-3")}>{item.snippet || "No description."}</p>
        {item.snippet.length > 220 && (
          <button onClick={() => setMore((v) => !v)} className="mt-1 text-[11.5px] font-medium text-accent">
            {more ? "Less" : "More"}
          </button>
        )}
      </div>
      <div className="mt-3">
        <ItemActions id={item.id} saved={Boolean(item.savedAt)} read={Boolean(item.readAt)} />
      </div>
    </GlassCard>
  );
}

/* ---------------- exercise ---------------- */

export function ExerciseCard({ exercise }: { exercise: NonNullable<BriefingData["exercise"]> }) {
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState(false);
  const [mine, setMine] = useState("");
  return (
    <GlassCard hover={false} className="p-5 sm:p-6">
      <Label>Apply it</Label>
      <p className="mt-2 text-[14.5px] leading-relaxed text-foreground">{exercise.prompt}</p>
      <label htmlFor="exercise-answer" className="sr-only">
        Your answer
      </label>
      <textarea
        id="exercise-answer"
        value={mine}
        onChange={(e) => setMine(e.target.value)}
        rows={3}
        placeholder="Work it out here first…"
        className="mt-3 w-full resize-y rounded-lg border border-hairline bg-tint/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {exercise.hint && (
          <button onClick={() => setHint(true)} className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground">
            Hint
          </button>
        )}
        <button onClick={() => setAnswer(true)} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim">
          Check the answer
        </button>
      </div>
      {hint && <p className="mt-3 text-[13px] leading-relaxed text-muted">Hint: {exercise.hint}</p>}
      {answer && <p className="mt-3 rounded-xl bg-emerald/[0.07] px-4 py-3 text-[13.5px] leading-relaxed text-foreground">{exercise.answer || "No worked answer was provided."}</p>}
    </GlassCard>
  );
}

/* ---------------- reviews ---------------- */

export interface DueReview {
  id: string;
  title: string;
  question: string;
  answer: string;
  interval: number;
}

export function ReviewCard({ r }: { r: DueReview }) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState<null | boolean>(null);
  if (done !== null)
    return (
      <div className="rounded-xl border border-hairline px-4 py-3 text-[12.5px] text-muted">
        {done ? "Nice. Next review is already scheduled." : "No problem: it comes back tomorrow."}
      </div>
    );
  return (
    <div className="rounded-xl border border-hairline bg-tint/[0.02] px-4 py-3.5">
      <p className="text-[11px] text-muted-2">
        {r.interval}-day review · {r.title}
      </p>
      <p className="mt-1 text-[14px] font-medium text-foreground">{r.question}</p>
      {shown ? (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{r.answer}</p>
          <div className="mt-3 flex gap-2">
            <button disabled={pending} onClick={() => start(async () => { await reviewAction(r.id, true); setDone(true); })} className="flex items-center gap-1 rounded-lg border border-emerald/30 bg-emerald/10 px-3 py-1.5 text-[12px] font-medium text-emerald">
              <Check size={12} /> I remembered
            </button>
            <button disabled={pending} onClick={() => start(async () => { await reviewAction(r.id, false); setDone(false); })} className="flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground">
              <X size={12} /> I didn&apos;t
            </button>
          </div>
        </>
      ) : (
        <button onClick={() => setShown(true)} className="mt-2 text-[12px] font-medium text-accent hover:underline">
          Recall it, then show the answer
        </button>
      )}
    </div>
  );
}

/* ---------------- refresh + live status ---------------- */

export interface JobInfo {
  status: string;
  stage: string;
  error: string | null;
  startedAt: string;
}

const STAGE_LABEL: Record<string, string> = { discover: "Finding sources", triage: "Sorting what matters", retrieve: "Reading the articles", synthesize: "Writing the briefing", store: "Saving", done: "Done" };

export function RefreshControl({ job, canRun }: { job: JobInfo | null; canRun: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [live, setLive] = useState(job);
  const [msg, setMsg] = useState<string | null>(null);
  // a fresh server render (router.refresh) brings a new job prop: adopt it
  const [prevJob, setPrevJob] = useState(job);
  if (job !== prevJob) {
    setPrevJob(job);
    setLive(job);
  }
  const running = live?.status === "running";

  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/edge/status", { cache: "no-store" });
        const j = (await r.json()) as { job: JobInfo | null };
        setLive(j.job);
        if (j.job && j.job.status !== "running") router.refresh();
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [running, router]);

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        disabled={!canRun || running || pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await refreshEdgeAction();
            if (r.status === "busy" || r.status === "skipped") setMsg(r.reason);
            else setLive({ status: "running", stage: "discover", error: null, startedAt: new Date().toISOString() });
          })
        }
        className="flex items-center gap-1.5 rounded-lg border border-hairline bg-tint/[0.03] px-3 py-2 text-[12.5px] font-medium text-foreground transition hover:border-hairline-strong disabled:opacity-60"
      >
        {running || pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {running ? STAGE_LABEL[live!.stage] ?? "Researching" : "Refresh now"}
      </button>
      {running && <p className="text-[11px] text-muted-2">Runs on the server: you can close this page.</p>}
      {msg && <p className="text-[11px] text-muted-2">{msg}</p>}
    </div>
  );
}

/* ---------------- weekly synthesis ---------------- */

export function WeeklyCard({ weekly, weekLabel, items, canRun }: { weekly: WeeklyData | null; weekLabel: string; items: Record<string, { title: string; url: string; publisher: string }>; canRun: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const links = (ids: string[]) =>
    ids.map((id) => items[id]).filter(Boolean).map((it) => (
      <a key={it.url} href={it.url} target="_blank" rel="noopener noreferrer" className="mr-2 text-[11.5px] text-muted-2 underline-offset-2 hover:text-accent hover:underline">
        {it.publisher}: {it.title.slice(0, 60)}
        {it.title.length > 60 ? "…" : ""}
      </a>
    ));
  return (
    <GlassCard hover={false} className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label>Weekly synthesis</Label>
          <p className="mt-1 text-[13px] text-muted">{weekly ? `Week of ${weekLabel}` : "Connects the week's stories. Runs on Sundays if switched on in Settings, or now."}</p>
        </div>
        <button
          disabled={!canRun || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await weeklyAction();
              if (!r.ok) setError(r.error);
              router.refresh();
            })
          }
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground disabled:opacity-50"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {weekly ? "Regenerate" : "Generate now"}
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-rose">{error}</p>}
      {weekly && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {weekly.connections.map((c, i) => (
              <div key={i} className="min-w-0 rounded-xl border border-hairline bg-tint/[0.02] p-3.5">
                <p className="text-[13px] font-semibold">{c.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{c.text}</p>
                <div className="mt-2">{links(c.itemIds)}</div>
              </div>
            ))}
          </div>
          {weekly.disagreement && (
            <div className="rounded-xl border border-sky/25 bg-sky/[0.05] p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky">Where the evidence disagrees</p>
              <p className="mt-1 text-[13px] font-semibold">{weekly.disagreement.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{weekly.disagreement.text}</p>
              <div className="mt-2">{links(weekly.disagreement.itemIds)}</div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-accent/20 bg-accent/[0.05] p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Business hypothesis (untested)</p>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground">{weekly.hypothesis}</p>
            </div>
            <div className="rounded-xl border border-hairline p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">A small experiment to test it</p>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground">{weekly.experiment}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-2">A hypothesis is a guess to test, not a prediction of profit. Nothing here is investment advice.</p>
        </div>
      )}
    </GlassCard>
  );
}
