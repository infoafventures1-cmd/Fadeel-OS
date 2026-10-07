import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { listPlans } from "@/lib/server/plans";
import { createPlanAction } from "@/app/actions";
import { TZ } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const plans = await listPlans();
  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <h1 className="text-[30px] font-semibold leading-none">
          University business <em>plans</em>.
        </h1>
        <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-muted">
          One living doc per idea. Open a plan and write it with an AI co-writer beside it. Pick Claude, ChatGPT, Gemini or Perplexity, ask for anything, and it writes straight into the plan.
        </p>
      </div>

      <GlassCard hover={false} className="mb-6 p-4">
        <form action={createPlanAction} className="flex flex-wrap gap-2">
          <input
            name="title"
            required
            placeholder="Idea name, e.g. Campus laundry pickup"
            className="min-w-0 flex-[1_1_220px] rounded-lg border border-hairline bg-tint/[0.03] px-3 py-2 text-[13.5px] text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
          />
          <input
            name="idea"
            placeholder="One line: what it does and for whom"
            className="min-w-0 flex-[2_1_280px] rounded-lg border border-hairline bg-tint/[0.03] px-3 py-2 text-[13.5px] text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
          />
          <button className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-accent-dim">
            <Plus size={14} /> Create plan
          </button>
        </form>
      </GlassCard>

      {plans.length === 0 ? (
        <GlassCard hover={false} className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <GraduationCap size={22} className="text-muted-2" />
          <p className="text-[13px] text-muted">No plans yet. Name your first idea above and press Create plan.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Link key={p.id} href={`/plans/${p.id}`}>
              <GlassCard className="flex h-[170px] flex-col p-4">
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">{p.title}</p>
                <p className="mt-1.5 line-clamp-2 flex-1 text-[12.5px] leading-relaxed text-muted">{p.idea || "No one-liner yet."}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint/[0.06]">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${p.total ? Math.round((p.filled / p.total) * 100) : 0}%` }} />
                </div>
                <p className="mt-2 font-mono text-[10.5px] text-muted-2">
                  {p.filled}/{p.total} sections · {new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })}
                </p>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
