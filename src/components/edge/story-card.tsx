"use client";

import { useState, useTransition } from "react";
import { BookOpenCheck, ChevronDown, GraduationCap, HelpCircle, Lightbulb, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { connectAction, learnedAction, simplerAction } from "@/app/edge-actions";
import type { EdgeItem, Lever, Story } from "@/lib/edge";
import { cn } from "@/lib/utils";
import { AccessBadge, SourceLine, TopicChip, TypeBadge } from "./meta";
import { ItemActions, TakeawayBox } from "./item-actions";

const LEVER: Record<Lever, string> = { costs: "Costs", revenue: "Revenue", competition: "Competition", incentives: "Incentives", risk: "Risk" };

export function StoryCard({ n, story, item, related, day }: { n: number; story: Story; item: EdgeItem; related: EdgeItem[]; day: string }) {
  const [open, setOpen] = useState(false);
  const independent = related.filter((r) => story.corroboratingIds.includes(r.id));
  const copies = related.filter((r) => story.syndicatedIds.includes(r.id));
  const summary = `${story.whatHappened} ${story.whyItMatters}`;

  return (
    <GlassCard hover={false} className="p-5 sm:p-6">
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <span className="tabular mr-1 font-mono text-[11px] text-muted-2">{String(n).padStart(2, "0")}</span>
        <TopicChip topic={story.topic} />
        <TypeBadge type={story.sourceType} />
        <AccessBadge access={item.access} />
        <span className={cn("rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium", independent.length ? "border-emerald/25 text-emerald" : "border-hairline text-muted-2")}>
          {independent.length ? `${independent.length + 1} independent sources` : "Single source"}
        </span>
      </div>

      <a href={item.url} target="_blank" rel="noopener noreferrer" className="group">
        <h3 className="text-[17px] font-semibold leading-snug text-foreground [text-wrap:balance] group-hover:text-accent sm:text-[18px]">{item.title}</h3>
      </a>
      <div className="mt-1.5">
        <SourceLine item={item} />
      </div>

      {story.accessNote && <p className="mt-3 rounded-lg border border-amber/25 bg-amber/[0.07] px-3 py-2 text-[12px] leading-relaxed text-amber">{story.accessNote}</p>}

      <div className="mt-4 space-y-3 text-[14px] leading-relaxed">
        <p className="text-foreground">{story.whatHappened}</p>
        {story.whyItMatters && (
          <p className="text-muted">
            <span className="font-semibold text-foreground">Why it matters: </span>
            {story.whyItMatters}
          </p>
        )}
      </div>

      {story.question && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-accent/20 bg-accent/[0.06] px-4 py-3">
          <HelpCircle size={15} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[13.5px] leading-relaxed text-foreground">
            <span className="font-semibold">Think about: </span>
            {story.question}
          </p>
        </div>
      )}

      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-4 flex items-center gap-1.5 text-[12.5px] font-medium text-muted hover:text-foreground">
        <ChevronDown size={14} className={cn("transition", open && "rotate-180")} />
        {open ? "Hide the analysis" : "Show the analysis: mechanism, evidence, sources"}
      </button>

      {open && (
        <div className="mt-4 space-y-5 border-t border-hairline pt-4">
          {story.mechanism.length > 0 && (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">The mechanism</p>
              <ul className="space-y-2">
                {story.mechanism.map((m, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                    <span className="mt-0.5 h-fit shrink-0 rounded-md bg-tint/[0.06] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-foreground">{LEVER[m.lever]}</span>
                    <span className="text-muted">{m.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid gap-3 md:grid-cols-3">
            <EvidenceList title="Established" hint="Stated in the sources" tone="emerald" items={story.established} />
            <EvidenceList title="Interpretation" hint="Analysis, not fact" tone="sky" items={story.interpretation} />
            <EvidenceList title="Still uncertain" hint="Open questions" tone="amber" items={story.uncertain} />
          </section>

          {(independent.length > 0 || copies.length > 0) && (
            <section className="text-[12.5px]">
              {independent.length > 0 && (
                <>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Independent reports of the same event</p>
                  <ul className="space-y-1">
                    {independent.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-x-2">
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-foreground underline-offset-2 hover:text-accent hover:underline">
                          {r.title}
                        </a>
                        <span className="text-muted-2">{r.publisher}</span>
                        <AccessBadge access={r.access} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {copies.length > 0 && (
                <p className="mt-2 text-muted-2">
                  Same report republished by {copies.map((c) => c.publisher || c.domain).join(", ")}: not counted as independent confirmation.
                </p>
              )}
            </section>
          )}

          {story.removed > 0 && (
            <p className="text-[11.5px] text-muted-2">
              {story.removed} AI-written statement{story.removed === 1 ? "" : "s"} removed: {story.removed === 1 ? "its" : "their"} figures or quotes weren&apos;t in the sources.
            </p>
          )}

          <LearnTools itemId={item.id} summary={summary} recall={story.recall} day={day} storyId={story.id} />
        </div>
      )}

      <div className="mt-5 space-y-3 border-t border-hairline pt-4">
        <ItemActions id={item.id} saved={Boolean(item.savedAt)} read={Boolean(item.readAt)} />
        <TakeawayBox id={item.id} initial={item.takeaway} />
      </div>
    </GlassCard>
  );
}

function EvidenceList({ title, hint, tone, items }: { title: string; hint: string; tone: "emerald" | "sky" | "amber"; items: string[] }) {
  const dot = { emerald: "bg-emerald", sky: "bg-sky", amber: "bg-amber" }[tone];
  return (
    <div className="min-w-0 rounded-xl border border-hairline bg-tint/[0.02] p-3">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {title}
      </p>
      <p className="mb-2 text-[10.5px] text-muted-2">{hint}</p>
      {items.length ? (
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-muted">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-muted-2">Nothing to add.</p>
      )}
    </div>
  );
}

/** Explain more simply, connect to Economics/Math, recall question, and "I've learned this" */
export function LearnTools({ itemId, summary, recall, day, storyId, kind = "story" }: { itemId: string | null; summary: string; recall: { q: string; a: string } | null; day: string; storyId?: string; kind?: "story" | "concept" }) {
  const [pending, start] = useTransition();
  const [simple, setSimple] = useState<string | null>(null);
  const [conn, setConn] = useState<{ economics: string; math: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [learned, setLearned] = useState(false);
  const tool = "inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-tint/[0.02] px-2.5 py-1.5 text-[12px] text-muted transition hover:border-hairline-strong hover:text-foreground disabled:opacity-50";

  return (
    <section className="space-y-3">
      {itemId && (
        <div className="flex flex-wrap gap-2">
          <button
            className={tool}
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await simplerAction(itemId, summary);
                if (r.ok) setSimple(r.text ?? null);
                else setError(r.error);
              })
            }
          >
            <Lightbulb size={13} /> Explain more simply
          </button>
          <button
            className={tool}
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await connectAction(itemId, summary);
                if (r.ok) setConn(r.connect ?? null);
                else setError(r.error);
              })
            }
          >
            <GraduationCap size={13} /> Connect to Economics or Math
          </button>
        </div>
      )}
      {pending && <p className="text-[12px] text-muted-2">Thinking, using only the retrieved text…</p>}
      {error && <p className="text-[12px] text-rose">{error}</p>}
      {simple && <p className="rounded-xl bg-tint/[0.03] px-4 py-3 text-[13.5px] leading-relaxed text-foreground">{simple}</p>}
      {conn && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-tint/[0.03] px-4 py-3 text-[13px] leading-relaxed">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">IB Economics</p>
            <p className="text-foreground">{conn.economics || "No clear link from the retrieved text."}</p>
          </div>
          <div className="rounded-xl bg-tint/[0.03] px-4 py-3 text-[13px] leading-relaxed">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Math AI</p>
            <p className="text-foreground">{conn.math || "No clear link from the retrieved text."}</p>
          </div>
        </div>
      )}
      {recall && (
        <div className="rounded-xl border border-hairline px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Sparkles size={12} className="text-accent" /> Recall question
          </p>
          <p className="mt-1.5 text-[13.5px] text-foreground">{recall.q}</p>
          {reveal ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              <span className="font-semibold text-foreground">Answer: </span>
              {recall.a}
            </p>
          ) : (
            <button onClick={() => setReveal(true)} className="mt-2 text-[12px] font-medium text-accent hover:underline">
              Show the answer
            </button>
          )}
          <div className="mt-3">
            <button
              disabled={learned || pending}
              onClick={() =>
                start(async () => {
                  const ok = await learnedAction(day, kind, storyId);
                  setLearned(ok);
                })
              }
              className={cn(tool, learned && "border-emerald/30 text-emerald")}
            >
              <BookOpenCheck size={13} /> {learned ? "Scheduled for review in 1, 7 and 30 days" : "I've learned this: schedule reviews"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
