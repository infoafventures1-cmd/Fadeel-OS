import { Sun } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

/** The day in a few plain sentences, worked out from the tasks, timetable and plan (src/lib/server/home.ts) */
export function DayBrief({ lines }: { lines: string[] }) {
  const [headline, ...rest] = lines;
  return (
    <GlassCard hover={false} className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15">
          <Sun size={12} className="text-accent" />
        </div>
        <p className="text-[11.5px] font-semibold uppercase tracking-wider text-accent">Today at a glance</p>
      </div>
      <p className="font-[family-name:var(--font-display)] text-[19px] font-semibold leading-snug text-foreground">{headline}</p>
      <ul className="mt-3 space-y-1.5">
        {rest.map((line) => (
          <li key={line} className="flex gap-2 text-[13.5px] leading-relaxed text-foreground/90">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            {line}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
