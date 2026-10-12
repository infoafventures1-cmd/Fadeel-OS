import Link from "next/link";
import { after } from "next/server";
import { AlertTriangle, Bookmark, Compass, History, Leaf, Sun } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { StoryCard } from "@/components/edge/story-card";
import { ConceptCard, DeepReadCard, ExerciseCard, Label, RefreshControl, ReviewCard, VideoCard, WeeklyCard } from "@/components/edge/sections";
import { AccessBadge, SourceLine, TopicChip, TypeBadge, fmtDay } from "@/components/edge/meta";
import { ItemActions, TakeawayBox } from "@/components/edge/item-actions";
import { SetupState } from "@/components/edge/setup-state";
import { TOPICS, type EdgeItem } from "@/lib/edge";
import { localDate, addDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import { acquire, catchUpDue, runJob, weekStart } from "@/lib/server/edge/pipeline";
import { getBriefing, getItems, getWeekly, latestWeekly, listExplore, listSaved } from "@/lib/server/edge/store";
import { learningHistory, listDueReviews } from "@/lib/server/edge/learn";
import { edgeCredentials, latestJob } from "@/lib/server/edge/status";

export const dynamic = "force-dynamic";
// The manual refresh continues in the background (after()) within this route's time limit
export const maxDuration = 300;

const TABS = [
  { key: "today", label: "Today", icon: Sun },
  { key: "explore", label: "Explore", icon: Compass },
  { key: "saved", label: "Saved", icon: Bookmark },
  { key: "history", label: "Learning History", icon: History },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function DailyEdgePage({ searchParams }: { searchParams: Promise<{ tab?: string; day?: string; topic?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "today") as Tab;
  const today = localDate();

  // Catch-up: if the scheduled run hasn't happened by your preferred time, opening this page starts it (once a day)
  if (await catchUpDue()) {
    const r = await acquire("catch-up");
    if (r.status === "started" || r.status === "resumed") {
      const id = r.jobId;
      after(() => runJob(id, 270_000));
    }
  }
  const [creds, job] = await Promise.all([edgeCredentials(), latestJob()]);

  return (
    <div className="mx-auto max-w-[920px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold leading-none">
            Daily <em>Edge</em>
          </h1>
          <p className="mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-muted">Twenty minutes a day on AI, finance and African fintech: what happened, why it matters, and how it works.</p>
        </div>
        <RefreshControl job={job} canRun={creds.ai || creds.search} />
      </div>

      <nav className="scrollbar-thin -mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Daily Edge sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "today" ? "/edge" : `/edge?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] transition",
              tab === t.key ? "bg-tint/[0.07] font-medium text-foreground" : "text-muted hover:bg-tint/[0.03] hover:text-foreground"
            )}
          >
            <t.icon size={14} className={tab === t.key ? "text-accent" : ""} />
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "today" && <TodayTab day={sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null} today={today} creds={creds} job={job} />}
      {tab === "explore" && <ExploreTab topic={sp.topic ?? "all"} />}
      {tab === "saved" && <SavedTab />}
      {tab === "history" && <HistoryTab canRun={creds.ai} />}
    </div>
  );
}

/* ---------------- Today ---------------- */

async function TodayTab({ day, today, creds, job }: { day: string | null; today: string; creds: Awaited<ReturnType<typeof edgeCredentials>>; job: Awaited<ReturnType<typeof latestJob>> }) {
  const [briefing, reviews] = await Promise.all([getBriefing(day ?? undefined), day ? Promise.resolve([]) : listDueReviews()]);
  const running = job?.status === "running";

  if (!briefing) {
    if (!creds.ai) return <SetupState creds={creds} />;
    return (
      <GlassCard hover={false} className="px-5 py-12 text-center">
        {running ? (
          <>
            <div className="mx-auto mb-4 h-1.5 w-40 overflow-hidden rounded-full bg-tint/[0.07]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
            </div>
            <p className="text-[14px] font-medium">Researching your first briefing…</p>
            <p className="mt-1 text-[12.5px] text-muted">Finding sources, reading articles and checking the evidence. This takes two to four minutes and keeps running if you close the page.</p>
          </>
        ) : (
          <>
            <p className="text-[14px] font-medium">No briefing yet.</p>
            <p className="mt-1 text-[12.5px] text-muted">{job?.status === "failed" ? `The last run failed: ${job.error}` : "Press Refresh now to run the research, or wait for the morning run."}</p>
          </>
        )}
      </GlassCard>
    );
  }

  const b = briefing.data;
  const ids = [
    ...b.stories.flatMap((s) => [s.itemId, ...s.corroboratingIds, ...s.syndicatedIds]),
    ...(b.deepRead ? [b.deepRead.itemId] : []),
    ...(b.video ? [b.video.itemId] : []),
  ];
  const items = new Map((await getItems(ids)).map((i) => [i.id, i]));
  const stale = briefing.day < today && !day;
  const lastFailed = job?.status === "failed" && job.day === today;

  return (
    <div className="space-y-5">
      {stale && (
        <div className="flex gap-2.5 rounded-xl border border-amber/30 bg-amber/[0.08] px-4 py-3 text-[13px] leading-relaxed text-foreground">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
          <p>
            <span className="font-semibold">This briefing is from {fmtDay(briefing.day)}, not today.</span>{" "}
            {running ? "Today's research is running now." : lastFailed ? `Today's refresh failed (${job?.error}). The last good briefing is kept below.` : "Today's run hasn't happened yet."}
          </p>
        </div>
      )}

      <GlassCard hover={false} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold">{fmtDay(briefing.day)}</p>
          <p className="text-[12.5px] text-muted">
            {b.stories.length} development{b.stories.length === 1 ? "" : "s"} · about {b.coreMinutes} minutes for the core briefing
            {day && day !== today ? " · past briefing" : ""}
          </p>
        </div>
        <p className="text-[11px] text-muted-2">Generated {new Date(b.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })} EAT</p>
      </GlassCard>

      {(b.notes.length > 0 || b.sourceFailures.length > 0) && (
        <div className="rounded-xl border border-hairline bg-tint/[0.02] px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">About today&apos;s evidence</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {b.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
            {b.sourceFailures.length > 0 && <li>{b.sourceFailures.length} source{b.sourceFailures.length === 1 ? "" : "s"} couldn&apos;t be reached: {b.sourceFailures.map((f) => f.name).join(", ")}. Details in Settings.</li>}
          </ul>
        </div>
      )}

      {reviews.length > 0 && (
        <section>
          <Label className="mb-2">Due for review ({reviews.length})</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {reviews.slice(0, 4).map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      {b.stories.length > 0 && (
        <section className="space-y-4">
          <Label>Important developments</Label>
          {b.stories.map((s, i) => {
            const item = items.get(s.itemId);
            if (!item) return null;
            const related = [...s.corroboratingIds, ...s.syndicatedIds].map((id) => items.get(id)).filter(Boolean) as EdgeItem[];
            return <StoryCard key={s.id} n={i + 1} story={s} item={item} related={related} day={briefing.day} />;
          })}
        </section>
      )}

      {b.deepRead && items.get(b.deepRead.itemId) && <DeepReadCard item={items.get(b.deepRead.itemId)!} why={b.deepRead.why} minutes={b.deepRead.minutes} optional={b.deepRead.optional} />}
      {b.concept && <ConceptCard concept={b.concept} day={briefing.day} />}
      {b.video && items.get(b.video.itemId) && <VideoCard item={items.get(b.video.itemId)!} why={b.video.why} optional={b.video.optional} />}
      {b.exercise && <ExerciseCard exercise={b.exercise} />}
    </div>
  );
}

/* ---------------- Explore ---------------- */

function ItemRow({ item, withTakeaway = false }: { item: EdgeItem; withTakeaway?: boolean }) {
  return (
    <GlassCard hover={false} className="px-4 py-3.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <TopicChip topic={item.topic} />
        <TypeBadge type={item.sourceType} />
        <AccessBadge access={item.access} />
        {item.kind === "video" && item.durationMin ? <span className="text-[10.5px] text-muted-2">{item.durationMin} min</span> : null}
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[14.5px] font-semibold leading-snug text-foreground hover:text-accent">
        {item.title}
      </a>
      <div className="mt-1">
        <SourceLine item={item} showRetrieved={false} />
      </div>
      {item.snippet && (
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
          {item.kind === "video" ? "From the description: " : item.access === "full" ? "" : "Snippet: "}
          {item.snippet}
        </p>
      )}
      <div className="mt-2.5 space-y-2.5">
        <ItemActions id={item.id} saved={Boolean(item.savedAt)} read={Boolean(item.readAt)} compact />
        {withTakeaway && <TakeawayBox id={item.id} initial={item.takeaway} />}
      </div>
    </GlassCard>
  );
}

async function ExploreTab({ topic }: { topic: string }) {
  const [recent, evergreen] = await Promise.all([listExplore({ topic }), listExplore({ topic, evergreen: true, limit: 12 })]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {[{ key: "all", short: "All topics" }, ...TOPICS].map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/edge?tab=explore" : `/edge?tab=explore&topic=${t.key}`}
            className={cn("rounded-lg border px-3 py-1.5 text-[12.5px] transition", topic === t.key ? "border-accent/30 bg-accent/10 text-accent" : "border-hairline text-muted hover:text-foreground")}
          >
            {t.short}
          </Link>
        ))}
      </div>
      <section className="space-y-2.5">
        <Label>This week, newest first</Label>
        {recent.length ? recent.map((i) => <ItemRow key={i.id} item={i} />) : <p className="text-[13px] text-muted">Nothing from the last seven days yet. Items appear after the first research run.</p>}
      </section>
      <section className="space-y-2.5">
        <Label className="flex items-center gap-1.5">
          <Leaf size={12} className="text-emerald" /> Evergreen learning: older, foundational material
        </Label>
        {evergreen.length ? evergreen.map((i) => <ItemRow key={i.id} item={i} />) : <p className="text-[13px] text-muted">Older research papers and lectures collect here over time.</p>}
      </section>
    </div>
  );
}

async function SavedTab() {
  const saved = await listSaved();
  return (
    <section className="space-y-2.5">
      <Label>Saved articles and videos ({saved.length})</Label>
      {saved.length ? saved.map((i) => <ItemRow key={i.id} item={i} withTakeaway />) : <p className="text-[13px] text-muted">Press Save on any story, article or video to keep it here.</p>}
    </section>
  );
}

/* ---------------- Learning History ---------------- */

async function HistoryTab({ canRun }: { canRun: boolean }) {
  const today = localDate();
  const [hist, reviews, weekly] = await Promise.all([learningHistory(), listDueReviews(), getWeekly(weekStart(today)).then(async (w) => (w ? { weekStart: weekStart(today), data: w } : await latestWeekly()))]);
  const weekItems = weekly ? await getItems([...weekly.data.connections.flatMap((c) => c.itemIds), ...(weekly.data.disagreement?.itemIds ?? [])]) : [];
  const itemMap = Object.fromEntries(weekItems.map((i) => [i.id, { title: i.title, url: i.url, publisher: i.publisher }]));
  const total = hist.recall.got + hist.recall.missed;
  const streak = (() => {
    let n = 0;
    for (let d = today; ; d = addDays(d, -1)) {
      const x = hist.days.find((h) => h.day === d);
      if (x && (x.takeaways > 0 || x.reads > 0)) n++;
      else if (d !== today) break;
      if (n > 60) break;
    }
    return n;
  })();

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Takeaways written" value={String(hist.takeaways.length)} />
        <Stat label="Recall rate" value={total ? `${Math.round((hist.recall.got / total) * 100)}%` : "–"} sub={total ? `${hist.recall.got} of ${total} reviews` : "No reviews yet"} />
        <Stat label="Learning streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub={`${hist.recall.upcoming} reviews scheduled`} />
      </div>

      {reviews.length > 0 && (
        <section>
          <Label className="mb-2">Due for review</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {reviews.map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      <WeeklyCard weekly={weekly?.data ?? null} weekLabel={weekly ? fmtDay(weekly.weekStart, false) : ""} items={itemMap} canRun={canRun} />

      <section className="space-y-2.5">
        <Label>Your takeaways</Label>
        {hist.takeaways.length ? (
          hist.takeaways.map((t) => (
            <GlassCard key={t.id} hover={false} className="px-4 py-3">
              <p className="text-[13.5px] leading-relaxed text-foreground">“{t.takeaway}”</p>
              <a href={t.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[11.5px] text-muted-2 hover:text-accent">
                {t.publisher}: {t.title} · {new Date(t.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Nairobi" })}
              </a>
            </GlassCard>
          ))
        ) : (
          <p className="text-[13px] text-muted">Write a one-line takeaway on any story. That&apos;s what counts as learning here, not clicks.</p>
        )}
      </section>

      <section className="space-y-2">
        <Label>Past briefings</Label>
        {hist.days.length ? (
          <GlassCard hover={false} className="divide-y divide-hairline px-4">
            {hist.days.map((d) => (
              <Link key={d.day} href={`/edge?day=${d.day}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px] hover:text-accent">
                <span className="font-medium">{fmtDay(d.day)}</span>
                <span className="min-w-0 truncate text-right text-[12px] text-muted">
                  {d.stories} stories{d.concept ? ` · ${d.concept}` : ""} · {d.reads} read · {d.takeaways} takeaway{d.takeaways === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </GlassCard>
        ) : (
          <p className="text-[13px] text-muted">Briefings you&apos;ve received appear here.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlassCard hover={false} className="px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular mt-1.5 text-[24px] font-semibold leading-none">{value}</p>
      {sub && <p className="mt-1 text-[11.5px] text-muted-2">{sub}</p>}
    </GlassCard>
  );
}
