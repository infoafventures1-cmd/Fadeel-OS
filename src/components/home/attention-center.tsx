"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, ListPlus, Plus, X } from "lucide-react";
import type { AttentionRecord } from "@/lib/task-types";
import { SeverityDot } from "@/components/ui/status-pill";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionHeader } from "@/components/ui/section-header";
import { addAttentionAction, attentionToTaskAction, resolveAttentionAction, toggleTaskAction } from "@/app/actions";
import { formatDue, localToISO } from "@/lib/time";
import { cn } from "@/lib/utils";

const SEVERITIES = [
  ["red", "Now"],
  ["orange", "Soon"],
  ["yellow", "Keep an eye"],
] as const;

export function AttentionCenter({ items }: { items: AttentionRecord[] }) {
  const [adding, setAdding] = useState(false);
  const [severity, setSeverity] = useState<AttentionRecord["severity"]>("orange");
  const [hidden, setHidden] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const visible = items.filter((i) => !hidden.includes(i.id));

  const dismiss = (item: AttentionRecord) => {
    setHidden((h) => [...h, item.id]);
    start(() => (item.kind === "manual" ? resolveAttentionAction(item.id) : toggleTaskAction(item.taskId!, true)));
  };

  return (
    <div>
      <SectionHeader
        title="Needs Your Attention"
        subtitle="Things you've flagged, plus overdue and due-soon tasks"
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition",
              adding ? "border-accent/40 text-accent" : "border-hairline text-muted hover:text-foreground"
            )}
          >
            {adding ? <X size={13} /> : <Plus size={13} />} {adding ? "Close" : "Add"}
          </button>
        }
      />

      <AnimatePresence>
        {adding && (
          <motion.form
            ref={formRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            action={(f) =>
              start(async () => {
                f.set("severity", severity);
                await addAttentionAction(f);
                formRef.current?.reset();
                setAdding(false);
              })
            }
            className="mb-3 overflow-hidden"
          >
            <GlassCard hover={false} className="space-y-2.5 p-3.5">
              <input
                name="title"
                required
                autoFocus
                maxLength={200}
                placeholder="What needs your attention?"
                className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-2 focus:outline-none"
              />
              <input
                name="detail"
                maxLength={400}
                placeholder="Details (optional)"
                className="w-full bg-transparent text-[12.5px] text-muted placeholder:text-muted-2 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                {SEVERITIES.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSeverity(key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition",
                      severity === key ? "border-accent/40 bg-accent/10 text-foreground" : "border-hairline text-muted"
                    )}
                  >
                    <SeverityDot severity={key} /> {label}
                  </button>
                ))}
                <input
                  type="date"
                  name="due"
                  aria-label="By when"
                  className="rounded-lg border border-hairline bg-transparent px-2 py-1 text-[11.5px] text-muted focus:outline-none"
                />
                <button type="submit" disabled={pending} className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim disabled:opacity-60">
                  Add
                </button>
              </div>
            </GlassCard>
          </motion.form>
        )}
      </AnimatePresence>

      {visible.length === 0 ? (
        <GlassCard hover={false} className="px-4 py-8 text-center text-[13px] text-muted">
          All clear. Add something when it lands on your plate.
        </GlassCard>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {visible.map((item) => (
            <GlassCard key={item.id} className="group flex items-start gap-3 p-3.5">
              <div className="mt-1.5">
                <SeverityDot severity={item.severity} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13.5px] font-medium text-foreground">{item.title}</p>
                  <span className="shrink-0 rounded-full border border-hairline px-1.5 py-0.5 text-[9.5px] text-muted-2">
                    {item.kind === "manual" ? "Flagged" : "Tasks"}
                  </span>
                </div>
                {item.detail && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{item.detail}</p>}
                {item.kind === "manual" && item.due && (
                  <p className="mt-1 text-[11px] text-muted-2">By {formatDue(localToISO(item.due), false)}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition group-hover:opacity-100">
                {item.kind === "manual" && (
                  <button
                    title="Turn into a task"
                    aria-label="Turn into a task"
                    onClick={() => {
                      setHidden((h) => [...h, item.id]);
                      start(() => attentionToTaskAction(item.id, item.title, item.due));
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-2 hover:bg-tint/5 hover:text-foreground"
                  >
                    <ListPlus size={14} />
                  </button>
                )}
                <button
                  title={item.kind === "manual" ? "Done, clear it" : "Mark the task done"}
                  aria-label="Done"
                  onClick={() => dismiss(item)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-2 hover:bg-tint/5 hover:text-emerald"
                >
                  <Check size={14} />
                </button>
                {item.link && (
                  <Link href={item.link} aria-label="Open" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-2 hover:bg-tint/5 hover:text-foreground">
                    <ChevronRight size={14} />
                  </Link>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
