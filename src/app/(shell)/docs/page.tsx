import Link from "next/link";
import { FilePlus2, FileText } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { listDocs } from "@/lib/server/docs";
import { createDocAction } from "@/app/actions";
import { TZ } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const docs = await listDocs();
  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-semibold leading-none">
            Write it <em>here</em>.
          </h1>
          <p className="mt-2 text-[13px] text-muted">Essays, notes and plans, saved as you type.</p>
        </div>
        <form action={createDocAction}>
          <button className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-accent-dim">
            <FilePlus2 size={14} /> New document
          </button>
        </form>
      </div>

      {docs.length === 0 ? (
        <GlassCard hover={false} className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <FileText size={22} className="text-muted-2" />
          <p className="text-[13px] text-muted">No documents yet. Start one with the button above.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Link key={d.id} href={`/docs/${d.id}`}>
              <GlassCard className="flex h-[170px] flex-col p-4">
                <p className="truncate text-[15px] font-semibold text-foreground">{d.title}</p>
                <p className="mt-1.5 line-clamp-4 flex-1 text-justify text-[12.5px] leading-relaxed text-muted">{d.content || "Empty"}</p>
                <p className="mt-2 font-mono text-[10.5px] text-muted-2">
                  {new Date(d.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })} · {Math.round(d.chars / 5.5)} words
                </p>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
