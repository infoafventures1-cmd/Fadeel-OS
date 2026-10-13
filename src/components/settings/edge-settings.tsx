"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Loader2, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { addSourceAction, checkSourcesAction, removeSourceAction, saveEdgeSettingsAction, toggleSourceAction } from "@/app/edge-actions";
import { TOPICS, type EdgeSettings as Settings } from "@/lib/edge";
import { cn } from "@/lib/utils";

export interface SourceView {
  id: string;
  name: string;
  kind: "rss" | "search" | "youtube";
  url?: string;
  site?: string;
  enabled: boolean;
  custom: boolean;
  lastStatus: string | null;
  lastError: string | null;
  lastItems: number | null;
  checkedAt: string | null;
  verifiedAt: string | null;
  note?: string;
  channelId?: string;
  idSource?: string;
}

export interface UsageView {
  month: { usd: number; calls: number };
  byPurpose: { purpose: string; calls: number; usd: number }[];
  jobs: { id: string; day: string; trigger: string; status: string; stage: string; error: string | null; cost: number; attempts: number; startedAt: string; finishedAt: string | null; log: { at: string; msg: string }[] }[];
}

const field = "rounded-lg border border-hairline bg-tint/[0.03] px-2.5 py-1.5 text-[13px] text-foreground focus:border-accent/60 focus:outline-none";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }) : "never");

export function EdgeSettings({ settings, sources, usage, creds, models }: { settings: Settings; sources: SourceView[]; usage: UsageView; creds: Record<string, boolean>; models: { id: string; label: string; ready: boolean }[] }) {
  const [s, setS] = useState(settings);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const total = TOPICS.reduce((n, t) => n + s.weights[t.key], 0) || 1;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSaved(false);
    setS((x) => ({ ...x, [k]: v }));
  };

  return (
    <div className="space-y-4">
      <GlassCard hover={false} className="p-4 sm:p-5">
        <p className="text-[13px] font-semibold">Connections</p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {[
            ["ai", "AI model for briefings"],
            ["triage", "AI model for triage"],
            ["search", "Web search (BRAVE_SEARCH_API_KEY)"],
            ["youtube", "YouTube Data API (YOUTUBE_API_KEY, optional)"],
            ["cron", "Daily schedule (CRON_SECRET)"],
          ].map(([k, label]) => (
            <p key={k} className="flex items-center gap-2 text-[12.5px]">
              {creds[k] ? <CheckCircle2 size={14} className="text-emerald" /> : <Circle size={14} className="text-muted-2" />}
              <span className={creds[k] ? "text-foreground" : "text-muted"}>{label}</span>
            </p>
          ))}
        </div>
      </GlassCard>

      <GlassCard hover={false} className="space-y-5 p-4 sm:p-5">
        <div>
          <p className="text-[13px] font-semibold">Topic weights</p>
          <p className="text-[12px] text-muted">Ranking preferences, not quotas: a weak story is never added just to fill a topic.</p>
          <div className="mt-3 space-y-2.5">
            {TOPICS.map((t) => (
              <label key={t.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[220px_1fr_60px]">
                <span className="text-[12.5px] text-foreground">{t.label}</span>
                <span className="tabular text-right text-[12px] text-muted sm:order-3">{Math.round((s.weights[t.key] / total) * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={s.weights[t.key]}
                  onChange={(e) => set("weights", { ...s.weights, [t.key]: Number(e.target.value) })}
                  className="col-span-2 accent-[var(--accent)] sm:order-2 sm:col-span-1"
                  aria-label={`${t.label} weight`}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[12.5px]">
            <span className="text-foreground">Preferred refresh time (Nairobi)</span>
            <input type="time" value={s.refreshTime} onChange={(e) => set("refreshTime", e.target.value)} className={cn(field, "mt-1 block")} />
            <span className="mt-1 block text-[11.5px] leading-relaxed text-muted-2">
              The server run is scheduled in vercel.json for 03:30 UTC. On Vercel&apos;s free Hobby plan it fires once a day at some point between 06:00 and 06:59 Nairobi time; on Pro, at 06:30 exactly. If it hasn&apos;t run by this time, opening Daily Edge starts it.
            </span>
          </label>
          <label className="block text-[12.5px]">
            <span className="text-foreground">Monthly spending cap (US$)</span>
            <input type="number" min={0} max={100} step={0.5} value={s.monthlyCapUsd} onChange={(e) => set("monthlyCapUsd", Number(e.target.value))} className={cn(field, "mt-1 block w-28")} />
            <span className="mt-1 block text-[11.5px] text-muted-2">
              AI and search calls stop when this month&apos;s spend reaches it. Spent so far: ${usage.month.usd.toFixed(2)}.
            </span>
          </label>
          <label className="block text-[12.5px]">
            <span className="text-foreground">Search queries per run</span>
            <input type="number" min={0} max={40} value={s.maxSearchQueries} onChange={(e) => set("maxSearchQueries", Number(e.target.value))} className={cn(field, "mt-1 block w-24")} />
          </label>
          <label className="block text-[12.5px]">
            <span className="text-foreground">Articles read in full per run</span>
            <input type="number" min={0} max={20} value={s.maxRetrieve} onChange={(e) => set("maxRetrieve", Number(e.target.value))} className={cn(field, "mt-1 block w-24")} />
            <span className="mt-1 block text-[11.5px] text-muted-2">Only shortlisted stories are retrieved; the rest stay headline-only.</span>
          </label>
          <label className="block text-[12.5px]">
            <span className="text-foreground">Candidates sent to triage</span>
            <input type="number" min={10} max={80} value={s.maxCandidates} onChange={(e) => set("maxCandidates", Number(e.target.value))} className={cn(field, "mt-1 block w-24")} />
          </label>
          <div className="space-y-2 text-[12.5px]">
            <label className="block">
              <span className="text-foreground">Briefing model</span>
              <select value={s.synthModel} onChange={(e) => set("synthModel", e.target.value)} className={cn(field, "mt-1 block")}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.ready ? "" : " (not connected)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-foreground">Triage model (cheap)</span>
              <select value={s.triageModel} onChange={(e) => set("triageModel", e.target.value)} className={cn(field, "mt-1 block")}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.ready ? "" : " (not connected)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <label className="flex items-start gap-2 text-[12.5px]">
          <input type="checkbox" checked={s.geminiFreeTier} onChange={(e) => set("geminiFreeTier", e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
          <span>
            My Gemini key is on Google&apos;s free tier: count Gemini calls as $0
            <span className="block text-[11.5px] text-muted-2">Only for calls through your own GEMINI_API_KEY. Free-tier limits (roughly 100–250 requests a day) are far above Daily Edge&apos;s 2–5 calls.</span>
          </span>
        </label>

        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={s.weekly} onChange={(e) => set("weekly", e.target.checked)} className="accent-[var(--accent)]" />
          Weekly synthesis every Sunday (three connections, one disagreement, one hypothesis, one experiment)
        </label>

        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                setS(await saveEdgeSettingsAction(s));
                setSaved(true);
              })
            }
            className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-accent-dim disabled:opacity-60"
          >
            Save Daily Edge settings
          </button>
          {saved && <span className="text-[12px] text-emerald">Saved</span>}
        </div>
      </GlassCard>

      <Sources sources={sources} />
      <Usage usage={usage} />
    </div>
  );
}

function Sources({ sources }: { sources: SourceView[] }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const groups: [SourceView["kind"], string][] = [
    ["rss", "Feeds (RSS)"],
    ["search", "Reached through web search"],
    ["youtube", "YouTube channels"],
  ];
  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold">Sources</p>
          <p className="text-[12px] text-muted">A source is where to look, not a promise of full text. Paywalled publishers contribute headlines and teasers only.</p>
        </div>
        <button
          disabled={pending}
          onClick={() => start(() => checkSourcesAction())}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground disabled:opacity-60"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Check feeds and channels now
        </button>
      </div>
      {groups.map(([kind, label]) => (
        <div key={kind} className="mt-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
          <div className="divide-y divide-hairline">
            {sources
              .filter((x) => x.kind === kind)
              .map((x) => (
                <div key={x.id} className="flex items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    defaultChecked={x.enabled}
                    onChange={(e) => start(() => toggleSourceAction(x.id, e.target.checked))}
                    aria-label={`Use ${x.name}`}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-foreground">
                      {x.name}
                      {x.lastStatus === "ok" ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald">
                          <CheckCircle2 size={11} /> {x.lastItems ?? 0} items · {when(x.checkedAt)}
                        </span>
                      ) : x.lastStatus === "failed" ? (
                        <span className="flex items-center gap-1 text-[11px] text-rose">
                          <XCircle size={11} /> failed {when(x.checkedAt)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-2">not checked yet</span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[10.5px] text-muted-2">{x.url ?? (x.site ? `site:${x.site}` : x.channelId ? `channel ${x.channelId}` : "channel id: resolved from handle with the YouTube API")}</p>
                    {x.lastError && <p className="text-[11px] text-rose">{x.lastError}</p>}
                    {(x.note || x.idSource) && <p className="text-[11px] text-muted-2">{x.note ?? `ID source: ${x.idSource}`}</p>}
                  </div>
                  {x.custom && (
                    <button aria-label={`Remove ${x.name}`} onClick={() => start(() => removeSourceAction(x.id))} className="text-muted-2 hover:text-rose">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
      <form
        action={() =>
          start(async () => {
            setMsg(null);
            const r = await addSourceAction(name, url);
            if (r.ok) {
              setName("");
              setUrl("");
              setMsg("Added and checked.");
            } else setMsg(r.error);
          })
        }
        className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-4"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Stratechery" aria-label="Feed name" className={cn(field, "min-w-0 flex-[1_1_160px]")} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="RSS feed URL" aria-label="Feed URL" className={cn(field, "min-w-0 flex-[2_1_240px]")} />
        <button disabled={pending || !name.trim() || !url.trim()} className="flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-foreground disabled:opacity-50">
          <Plus size={12} /> Add feed
        </button>
        {msg && <p className="w-full text-[11.5px] text-muted">{msg}</p>}
      </form>
    </GlassCard>
  );
}

function Usage({ usage }: { usage: UsageView }) {
  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <p className="text-[13px] font-semibold">Usage and runs</p>
      <p className="text-[12px] text-muted">
        This month: ${usage.month.usd.toFixed(3)} across {usage.month.calls} paid calls (AI token costs are estimates from list prices).
      </p>
      {usage.byPurpose.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {usage.byPurpose.map((p) => (
            <span key={p.purpose} className="rounded-md border border-hairline px-2 py-0.5 text-[11px] text-muted">
              {p.purpose}: {p.calls} · ${p.usd.toFixed(3)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 divide-y divide-hairline">
        {usage.jobs.length === 0 && <p className="py-2 text-[12px] text-muted-2">No runs yet.</p>}
        {usage.jobs.map((j) => (
          <details key={j.id} className="py-2 text-[12px]">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={cn("font-medium", j.status === "done" ? "text-emerald" : j.status === "failed" ? "text-rose" : "text-amber")}>{j.status}</span>
              <span className="text-foreground">{when(j.startedAt)}</span>
              <span className="text-muted-2">
                {j.trigger} · stage {j.stage} · attempt {j.attempts} · ${j.cost.toFixed(3)}
              </span>
              {j.error && <span className="w-full text-rose">{j.error}</span>}
            </summary>
            <ol className="mt-1.5 space-y-0.5 pl-4 font-mono text-[10.5px] text-muted">
              {j.log.map((l, i) => (
                <li key={i}>
                  {new Date(l.at).toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" })} {l.msg}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </GlassCard>
  );
}
