import Link from "next/link";
import { PROJECTS } from "@/config";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionHeader } from "@/components/ui/section-header";
import { formatDue } from "@/lib/time";
import type { HomeData } from "@/lib/server/home";

export function ProjectHealthStrip({ projects }: { projects: HomeData["byProject"] }) {
  const byKey = new Map(projects);

  return (
    <div>
      <SectionHeader title="Projects" subtitle="Open tasks and the next deadline in each" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {PROJECTS.map((p) => {
          const info = byKey.get(p.key);
          return (
            <Link key={p.key} href="/tasks">
              <GlassCard className="h-full p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-mono text-[11px] tabular text-muted">{info?.open ?? 0} open</span>
                </div>
                <p className="text-[13px] font-medium text-foreground">{p.name}</p>
                <p className="mt-1 truncate text-[11.5px] text-muted-2">
                  {info?.next ? `${formatDue(info.next.deadline, false)} · ${info.next.title}` : "No deadlines"}
                </p>
              </GlassCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
