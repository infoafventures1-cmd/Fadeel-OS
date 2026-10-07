import { cn } from "@/lib/utils";
import type { Severity, Priority } from "@/lib/types";

export function SeverityDot({ severity }: { severity: Severity }) {
  const color = severity === "red" ? "#c2334a" : severity === "orange" ? "#a86a00" : "#b99700";
  return <span className="pulse-dot inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />;
}

const priorityMap: Record<Priority, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-rose/15 text-rose border-rose/30" },
  high: { label: "High", className: "bg-amber/15 text-amber border-amber/30" },
  medium: { label: "Medium", className: "bg-sky/15 text-sky border-sky/30" },
  low: { label: "Low", className: "bg-muted/15 text-muted border-hairline" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = priorityMap[priority];
  return (
    <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", m.className)}>
      {m.label}
    </span>
  );
}
