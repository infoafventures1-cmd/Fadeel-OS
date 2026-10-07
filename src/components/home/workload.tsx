import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import type { HomeData } from "@/lib/server/home";

export function Workload({ stats }: { stats: HomeData["stats"] }) {
  const rows = [
    { label: "Open tasks", value: stats.open, href: "/tasks" },
    { label: "High or urgent", value: stats.urgent, tone: stats.urgent ? "text-amber" : undefined },
    { label: "Overdue", value: stats.overdue, tone: stats.overdue ? "text-rose" : undefined },
    { label: "Waiting on others", value: stats.waiting },
    { label: "Done this week", value: stats.doneThisWeek, tone: stats.doneThisWeek ? "text-emerald" : undefined },
  ];
  return (
    <GlassCard hover={false} className="p-5">
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Workload</p>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-display)] text-[40px] font-semibold leading-none tabular">
          {Math.floor(stats.freeToday / 60)}
          <span className="text-[22px] text-muted">h</span> {stats.freeToday % 60}
          <span className="text-[22px] text-muted">m</span>
        </span>
        <span className="text-[12px] text-muted">free today</span>
      </div>
      <div className="divide-y divide-hairline">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-muted">{r.label}</span>
            <span className={`tabular font-medium ${r.tone ?? "text-foreground"}`}>{r.value}</span>
          </div>
        ))}
      </div>
      <Link href="/tasks" className="mt-3 inline-block text-[12px] text-accent hover:underline">
        Open tasks →
      </Link>
    </GlassCard>
  );
}
