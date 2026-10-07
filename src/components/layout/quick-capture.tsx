"use client";

import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap, Sparkles, Check, Flag } from "lucide-react";
import { parseCapture, type Captured } from "@/lib/capture";
import { PROJECTS } from "@/config";
import { PRIORITIES } from "@/lib/task-types";
import { addAttentionAction, createTaskAction } from "@/app/actions";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-hairline bg-tint/[0.03] px-2 py-1.5 text-[12.5px] text-foreground focus:border-accent/50 focus:outline-none";

type Overrides = Partial<Pick<Captured, "project" | "priority" | "date" | "time" | "estimate">>;

export function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  // anything the user changes by hand wins over what was detected
  const [edits, setEdits] = useState<Overrides>({});
  const [asAttention, setAsAttention] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);

  const detected = text.trim() ? parseCapture(text) : null;
  const v = detected ? { ...detected, ...edits } : null;

  const close = () => {
    onClose();
    setText("");
    setEdits({});
    setAsAttention(false);
  };

  const save = () => {
    if (!v || !v.title || pending) return;
    start(async () => {
      const f = new FormData();
      f.set("title", v.title);
      if (asAttention) {
        f.set("severity", v.priority === "urgent" ? "red" : v.priority === "low" ? "yellow" : "orange");
        if (v.date) f.set("due", v.date);
        await addAttentionAction(f);
      } else {
        f.set("project", v.project);
        f.set("priority", v.priority);
        if (v.date) f.set("date", v.date);
        if (v.date && v.time) f.set("time", v.time);
        if (v.estimate) f.set("estimate", String(v.estimate));
        await createTaskAction(f);
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        close();
      }, 550);
    });
  };

  const tag = (key: keyof Overrides, found: boolean) =>
    key in edits ? (
      <span className="text-muted-2">edited</span>
    ) : found ? (
      <span className="text-accent">detected</span>
    ) : (
      <span className="text-muted-2">not found</span>
    );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-[16vh] backdrop-blur-sm sm:items-center sm:pb-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="glass w-full max-w-[560px] overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && close()}
          >
            <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
              <Zap size={15} className="text-accent" />
              <span className="text-[13px] font-medium">Quick Capture</span>
              <button
                onClick={() => {
                  setAsAttention((a) => !a);
                  input.current?.focus(); // so Enter still saves
                }}
                className={cn(
                  "ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition",
                  asAttention ? "border-accent/40 bg-accent/10 text-accent" : "border-hairline text-muted hover:text-foreground"
                )}
                title="Save to Needs Your Attention instead of Tasks"
              >
                <Flag size={11} /> {asAttention ? "Saving to Attention" : "Flag for attention instead"}
              </button>
            </div>
            <div className="p-4">
              <textarea
                ref={input}
                autoFocus
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    save();
                  }
                }}
                placeholder='"History essay next fri 2pm urgent 90m"'
                className="w-full resize-none bg-transparent text-[15px] text-foreground placeholder:text-muted-2 focus:outline-none"
              />
              <AnimatePresence>
                {v && detected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden rounded-xl border border-hairline bg-tint/[0.03] p-3"
                  >
                    <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-accent">
                      <Sparkles size={11} />
                      <span className="truncate text-foreground">{v.title}</span>
                    </div>
                    {!asAttention && (
                      <div className="grid grid-cols-2 gap-2.5 text-[10.5px] uppercase tracking-wider text-muted-2 sm:grid-cols-3">
                        <label className="flex flex-col gap-1">
                          <span className="flex justify-between">Project {tag("project", detected.project !== "personal")}</span>
                          <select value={v.project} onChange={(e) => setEdits({ ...edits, project: e.target.value })} className={field}>
                            {PROJECTS.map((p) => (
                              <option key={p.key} value={p.key}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="flex justify-between">Priority {tag("priority", Boolean(detected.priorityWhy))}</span>
                          <select value={v.priority} onChange={(e) => setEdits({ ...edits, priority: e.target.value as Captured["priority"] })} className={field}>
                            {PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {p[0].toUpperCase() + p.slice(1)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="flex justify-between">Takes (min) {tag("estimate", detected.estimate !== null)}</span>
                          <input
                            type="number"
                            min={5}
                            step={5}
                            placeholder="30"
                            value={v.estimate ?? ""}
                            onChange={(e) => setEdits({ ...edits, estimate: e.target.value ? Number(e.target.value) : null })}
                            className={field}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="flex justify-between">Due {tag("date", detected.date !== null)}</span>
                          <input type="date" value={v.date ?? ""} onChange={(e) => setEdits({ ...edits, date: e.target.value || null })} className={field} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="flex justify-between">Time {tag("time", detected.time !== null)}</span>
                          <input type="time" value={v.time ?? ""} onChange={(e) => setEdits({ ...edits, time: e.target.value || null })} className={field} />
                        </label>
                        {detected.priorityWhy && !("priority" in edits) && (
                          <p className="self-end pb-1.5 text-[11px] normal-case tracking-normal text-muted">
                            {detected.priority[0].toUpperCase() + detected.priority.slice(1)}: {detected.priorityWhy}
                          </p>
                        )}
                      </div>
                    )}
                    {asAttention && <p className="text-[12px] text-muted">Goes to Needs Your Attention on Home{v.date ? `, by ${v.date}` : ""}.</p>}
                  </motion.div>
                )}
              </AnimatePresence>
              {!v && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted-2">
                  Understands dates (tomorrow, fri, next mon, 14 oct, in 2 weeks), times (5pm, 17:30), priority (urgent, important, whenever, !!) and
                  length (45m, 2h).
                </p>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5">
              <span className="text-[10.5px] text-muted-2">Enter to save · Shift+Enter for a new line · Esc to dismiss</span>
              <button
                onClick={save}
                disabled={!v?.title || pending || saved}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition disabled:opacity-40"
              >
                {saved ? (
                  <>
                    <Check size={12} /> Saved
                  </>
                ) : pending ? (
                  "Saving…"
                ) : asAttention ? (
                  "Flag it"
                ) : (
                  "Create task"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
