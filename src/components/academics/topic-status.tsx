"use client";

import { useOptimistic, useTransition } from "react";
import { setTopicStatusAction } from "@/app/academics-actions";
import { TOPIC_STATUSES, topicStatus, type TopicStatus } from "@/lib/academics";
import { cn } from "@/lib/utils";

export const fieldClass =
  "rounded-lg border border-hairline bg-tint/[0.03] px-3 py-2 text-[13.5px] text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none";

/** Coloured dot + label that is also a picker: choose a new confidence level and it saves */
export function TopicStatusPicker({ id, status, className }: { id: string; status: TopicStatus; className?: string }) {
  const [, start] = useTransition();
  const [value, setValue] = useOptimistic(status);
  const s = topicStatus(value);

  return (
    <label className={cn("relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12.5px] hover:bg-tint/[0.04]", className)} style={{ color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
      <select
        aria-label="Confidence"
        value={value}
        onChange={(e) => {
          const next = e.target.value as TopicStatus;
          start(async () => {
            setValue(next);
            await setTopicStatusAction(id, next);
          });
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {TOPIC_STATUSES.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
