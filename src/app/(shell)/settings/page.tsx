import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionHeader } from "@/components/ui/section-header";
import { TimetableEditor } from "@/components/settings/timetable-editor";
import { AiSettings } from "@/components/settings/ai-settings";
import { modelStatus } from "@/lib/server/ai";
import { listTimetable } from "@/lib/server/data";
import { isoWeekday, localDate } from "@/lib/time";
import { APP_NAME, OWNER, PROJECTS, TIMEZONE, WEATHER } from "@/config";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const slots = await listTimetable();
  const profile = [
    ["Dashboard name", APP_NAME],
    ["Name", OWNER.fullName],
    ["Google account", OWNER.email],
    ["Timezone", TIMEZONE],
    ["Weather city", WEATHER?.city ?? "Off"],
    ["Projects", PROJECTS.map((p) => p.name).join(", ")],
  ];

  return (
    <div className="mx-auto max-w-[900px] space-y-8">
      <div>
        <h1 className="text-[30px] font-semibold leading-none">
          Make it <em>yours</em>.
        </h1>
        <p className="mt-2 text-[13px] text-muted">Your weekly timetable, and where the rest of the dashboard is set up.</p>
      </div>

      <div>
        <SectionHeader title="Weekly timetable" subtitle="Fixed commitments. Plan My Day schedules your tasks around them." />
        <TimetableEditor slots={slots} today={isoWeekday(localDate())} />
      </div>

      <div>
        <SectionHeader title="Day routine" subtitle="When your day starts and ends, break length, and daily blocks like dinner or the gym" />
        <GlassCard hover={false} className="px-4 py-3.5 text-[13px] text-muted">
          Set on the{" "}
          <Link href="/today" className="text-accent hover:underline">
            Today page
          </Link>
          : open the sliders button next to Plan My Day.
        </GlassCard>
      </div>

      <div id="ai" className="scroll-mt-24">
        <SectionHeader title="AI models" subtitle="Used by the Assistant, Documents and University Plans. Press Test to check one answers." />
        <GlassCard hover={false} className="px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-muted">
            Keys live in Vercel, never in the code: <span className="text-foreground">Settings › Environment Variables</span>, then redeploy. The easiest route is one{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">OpenRouter</a> key
            (<span className="font-mono text-[11.5px]">OPENROUTER_API_KEY</span>), which runs every model below. Or add each company&apos;s own key:{" "}
            <span className="font-mono text-[11.5px]">ANTHROPIC_API_KEY</span>, <span className="font-mono text-[11.5px]">OPENAI_API_KEY</span>,{" "}
            <span className="font-mono text-[11.5px]">GEMINI_API_KEY</span>, <span className="font-mono text-[11.5px]">PERPLEXITY_API_KEY</span>. A company&apos;s own key wins when both are set.
            If a model fails its test, its id has probably changed: update it in <span className="font-mono text-[11.5px]">src/config.ts</span>.
          </p>
          <div className="mt-2">
            <AiSettings models={modelStatus()} />
          </div>
        </GlassCard>
      </div>

      <div>
        <SectionHeader title="Profile" subtitle="These live in the code. Edit src/config.ts and redeploy to change them." />
        <GlassCard hover={false} className="divide-y divide-hairline px-4">
          {profile.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 text-[13px]">
              <span className="shrink-0 text-muted">{label}</span>
              <span className="min-w-0 truncate text-right text-foreground">{value}</span>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );
}
