import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import type { EdgeCredentials } from "@/lib/server/edge/status";

/** Honest setup-required state: what works now, what each missing key adds. No sample news is ever shown. */
export function SetupState({ creds }: { creds: EdgeCredentials }) {
  const rows: [boolean, string, string][] = [
    [creds.ai, "AI model for the briefing", "OPENROUTER_API_KEY (or ANTHROPIC_API_KEY). Without it, discovered articles still appear in Explore, but no briefing is written."],
    [creds.search, "Web search (Brave Search API)", "BRAVE_SEARCH_API_KEY. Adds Reuters, Bloomberg, FT, The Batch, IMF, CBK and filings. Without it, only the RSS feeds and YouTube channels are used."],
    [creds.youtube, "YouTube Data API (optional)", "YOUTUBE_API_KEY. Adds video lengths and finds Y Combinator's channel from its handle. Channel feeds work without it."],
    [creds.cron, "Daily schedule", "CRON_SECRET (16+ random characters). Lets Vercel run the research every morning while your browser is closed."],
  ];
  return (
    <GlassCard hover={false} className="p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Setup required</p>
      <h2 className="mt-1.5 text-[19px] font-semibold">Daily Edge needs a couple of keys before it can write your first briefing.</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        Add them in Vercel › Settings › Environment Variables, then redeploy. They stay on the server and never reach the browser. Until then this page stays empty rather than showing made-up news.
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map(([ok, name, how]) => (
          <li key={name} className="flex gap-3">
            {ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald" /> : <Circle size={17} className="mt-0.5 shrink-0 text-muted-2" />}
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-foreground">
                {name} <span className={ok ? "text-emerald" : "text-muted-2"}>· {ok ? "connected" : "not set"}</span>
              </p>
              <p className="text-[12.5px] leading-relaxed text-muted">{how}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12.5px] text-muted">
        Sources, topic weights, limits and the spending cap are in{" "}
        <Link href="/settings#edge" className="text-accent hover:underline">
          Settings › Daily Edge
        </Link>
        .
      </p>
    </GlassCard>
  );
}
