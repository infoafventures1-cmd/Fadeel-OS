import { ArrowUpRight } from "lucide-react";
import { QUICK_LINKS } from "@/config";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionHeader } from "@/components/ui/section-header";

export function QuickLinksGrid() {
  if (QUICK_LINKS.length === 0) return null;
  return (
    <div>
      <SectionHeader title="Quick Links" subtitle="Your everyday tools, one click away" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {QUICK_LINKS.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
            <GlassCard className="group flex items-center gap-2.5 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint/[0.05] font-[family-name:var(--font-display)] text-[14px] font-semibold text-foreground transition group-hover:bg-accent group-hover:text-white">
                {link.label[0]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{link.label}</span>
              <ArrowUpRight size={12} className="shrink-0 text-muted-2 transition group-hover:text-accent" />
            </GlassCard>
          </a>
        ))}
      </div>
    </div>
  );
}
