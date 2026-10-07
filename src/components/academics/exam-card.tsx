import { Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { TOPIC_STATUSES, daysUntilDay, isReady, shortUntil, type Subject } from "@/lib/academics";
import { cn } from "@/lib/utils";
import { TopicStatusPicker } from "./topic-status";

const rank = (s: string) => TOPIC_STATUSES.findIndex((x) => x.key === s);

/** One subject in Exam Mode: its topics, how many are ready, and what to revise next */
export function ExamCard({ subject }: { subject: Subject }) {
  const date = subject.nextAssessmentDate!;
  const n = daysUntilDay(date);
  const ready = subject.topics.filter((t) => isReady(t.status)).length;
  const weakest = subject.topics
    .filter((t) => !isReady(t.status))
    .sort((a, b) => rank(a.status) - rank(b.status))
    .slice(0, 2);
  const remaining = n <= 0 ? "the exam today" : n === 1 ? "tomorrow remaining" : `${shortUntil(date)} remaining`;

  return (
    <GlassCard hover={false} className="p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold">{subject.name}</h2>
          <p className="mt-1 text-[14px] text-muted">
            {ready}/{subject.topics.length} topics ready{subject.nextAssessment ? ` · ${subject.nextAssessment}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-[12.5px]",
            n <= 1 ? "border-rose/30 bg-rose/10 text-rose" : n <= 7 ? "border-amber/30 bg-amber/10 text-amber" : "border-hairline text-muted"
          )}
        >
          {shortUntil(date)}
        </span>
      </div>

      {subject.topics.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline-strong px-4 py-3 text-[13px] text-muted">No topics yet. Add them on the School page.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {subject.topics.map((t) => (
            <div key={t.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-hairline bg-tint/[0.02] px-4 py-2.5">
              <p className="min-w-0 flex-1 truncate text-[14px] text-foreground">{t.title}</p>
              <TopicStatusPicker id={t.id} status={t.status} className="text-[12px]" />
            </div>
          ))}
        </div>
      )}

      {subject.topics.length > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-accent/20 bg-accent/[0.07] px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
          <Sparkles size={14} className="mt-[3px] shrink-0 text-accent" />
          {weakest.length ? (
            <p>
              Revise <strong className="font-semibold">{weakest.map((t) => t.title).join(" and ")}</strong> next: lowest confidence with {remaining}.
            </p>
          ) : (
            <p>Every topic is ready. Do a timed past paper to lock it in.</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
