"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Check, Circle, ThumbsDown, ThumbsUp, PenLine } from "lucide-react";
import { feedbackAction, readItemAction, saveItemAction, takeawayAction } from "@/app/edge-actions";
import { cn } from "@/lib/utils";

const btn = "inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[11.5px] text-muted transition hover:border-hairline-strong hover:text-foreground disabled:opacity-50";

/** Save, mark read, more/less like this. Optimistic, then saved on the server. */
export function ItemActions({ id, saved, read, compact = false }: { id: string; saved: boolean; read: boolean; compact?: boolean }) {
  const [, start] = useTransition();
  const [s, setS] = useOptimistic(saved);
  const [r, setR] = useOptimistic(read);
  const [fb, setFb] = useState<1 | -1 | 0>(0);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        className={cn(btn, s && "border-accent/30 bg-accent/10 text-accent")}
        aria-pressed={s}
        onClick={() =>
          start(async () => {
            setS(!s);
            await saveItemAction(id, !s);
          })
        }
      >
        {s ? <BookmarkCheck size={12} /> : <Bookmark size={12} />} {s ? "Saved" : "Save"}
      </button>
      <button
        className={cn(btn, r && "border-emerald/30 bg-emerald/10 text-emerald")}
        aria-pressed={r}
        onClick={() =>
          start(async () => {
            setR(!r);
            await readItemAction(id, !r);
          })
        }
      >
        {r ? <Check size={12} /> : <Circle size={12} />} {r ? "Read" : "Mark read"}
      </button>
      <span className={cn("ml-auto flex items-center gap-1", compact && "ml-0")}>
        <button
          className={cn(btn, "px-1.5", fb === 1 && "border-emerald/30 text-emerald")}
          aria-label="More like this"
          title="More like this"
          disabled={fb !== 0}
          onClick={() => {
            setFb(1);
            start(() => feedbackAction(id, 1));
          }}
        >
          <ThumbsUp size={12} />
          {!compact && <span className="hidden sm:inline">More like this</span>}
        </button>
        <button
          className={cn(btn, "px-1.5", fb === -1 && "border-rose/30 text-rose")}
          aria-label="Less like this"
          title="Less like this"
          disabled={fb !== 0}
          onClick={() => {
            setFb(-1);
            start(() => feedbackAction(id, -1));
          }}
        >
          <ThumbsDown size={12} />
          {!compact && <span className="hidden sm:inline">Less</span>}
        </button>
      </span>
    </div>
  );
}

/** A short personal takeaway. Saving one also schedules it for recall in 1, 7 and 30 days. */
export function TakeawayBox({ id, initial }: { id: string; initial: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(Boolean(initial));
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className={btn}>
        <PenLine size={12} /> Write a takeaway
      </button>
    );
  return (
    <div className="space-y-1.5">
      <label htmlFor={`tk-${id}`} className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        Your takeaway
      </label>
      <textarea
        id={`tk-${id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="One or two sentences in your own words: what changed in how you see this?"
        className="w-full resize-y rounded-lg border border-hairline bg-tint/[0.03] px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          disabled={pending || text.trim() === saved.trim()}
          onClick={() =>
            start(async () => {
              await takeawayAction(id, text);
              setSaved(text);
            })
          }
          className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save takeaway"}
        </button>
        <span className="text-[11px] text-muted-2">{saved && text === saved ? "Saved. You'll be asked to recall it in 1, 7 and 30 days." : ""}</span>
      </div>
    </div>
  );
}
