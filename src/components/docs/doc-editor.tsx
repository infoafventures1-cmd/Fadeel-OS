"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Download, Trash2, Wand2, Sparkles, Loader2, Undo2, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { deleteDocAction, saveDocAction } from "@/app/actions";
import { askAI, ModelPicker, Sources, useModelChoice, type ModelInfo } from "@/components/ai/model-picker";
import type { Doc } from "@/lib/server/docs";
import { cn } from "@/lib/utils";

const ACTIONS: [key: string, label: string][] = [
  ["improve", "Improve"],
  ["shorten", "Shorten"],
  ["expand", "Expand"],
  ["grammar", "Fix grammar"],
  ["formal", "More formal"],
  ["simpler", "Simpler"],
  ["continue", "Continue writing"],
  ["feedback", "Give feedback"],
];

interface Result {
  action: string;
  label: string;
  text: string;
  start: number;
  end: number;
  partial: boolean;
  sources: string[];
  model: string;
}

export function DocEditor({ doc, models }: { doc: Doc; models: ModelInfo[] }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const first = useRef(true);
  const area = useRef<HTMLTextAreaElement>(null);

  const [modelId, setModelId] = useModelChoice(models);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [undo, setUndo] = useState<string | null>(null);

  // autosave a moment after typing stops
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("unsaved");
    const t = setTimeout(async () => {
      setStatus("saving");
      await saveDocAction(doc.id, title, content);
      setStatus("saved");
    }, 900);
    return () => clearTimeout(t);
  }, [title, content, doc.id]);

  const hasSel = sel.end > sel.start;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const selWords = hasSel ? content.slice(sel.start, sel.end).trim().split(/\s+/).filter(Boolean).length : 0;

  async function run(action: string, label: string) {
    if (busy) return;
    const custom = action === "custom" ? instruction.trim() : "";
    if (action === "custom" && !custom) return;
    const partial = hasSel && action !== "continue";
    const range = partial ? sel : { start: 0, end: content.length };
    setBusy(action);
    setError("");
    setResult(null);
    try {
      const r = await askAI<{ text: string; sources: string[]; model: string }>({
        task: "doc",
        modelId,
        action,
        instruction: custom,
        title,
        text: action === "continue" ? content.slice(-6000) : content.slice(range.start, range.end),
        full: partial ? content : "",
        partial,
      });
      setResult({ action, label: action === "custom" ? custom : label, text: r.text, start: range.start, end: range.end, partial, sources: r.sources, model: r.model });
      if (action === "custom") setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function apply(mode: "replace" | "insert" | "append") {
    if (!result) return;
    setUndo(content);
    let next = content;
    if (mode === "append") next = content.replace(/\s*$/, "") + (content.trim() ? "\n\n" : "") + result.text;
    else if (mode === "insert") next = content.slice(0, result.end) + "\n\n" + result.text + content.slice(result.end);
    else next = content.slice(0, result.start) + result.text + content.slice(result.end);
    setContent(next);
    setResult(null);
    setSel({ start: 0, end: 0 });
  }

  const isFeedback = result?.action === "feedback";
  const isContinue = result?.action === "continue";

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/docs" className="flex items-center gap-1 text-[12.5px] text-muted hover:text-foreground">
          <ArrowLeft size={13} /> Documents
        </Link>
        <span className="ml-auto font-mono text-[11px] text-muted-2">
          {words} words{hasSel ? ` · ${selWords} selected` : ""} · {status === "saved" ? "saved" : status === "saving" ? "saving…" : "unsaved"}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-muted hover:text-foreground"
        >
          {copied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />} Copy
        </button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`${title}\n\n${content}`)}`}
          download={`${title.replace(/[^\w\- ]+/g, "").trim() || "document"}.txt`}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-muted hover:text-foreground"
        >
          <Download size={12} /> Download
        </a>
        <button
          onClick={() => confirm(`Delete “${title}”? This can't be undone.`) && start(() => deleteDocAction(doc.id))}
          aria-label="Delete document"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-hairline text-muted-2 hover:text-rose"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <GlassCard hover={false} className="p-6 sm:p-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="mb-4 w-full bg-transparent font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-tight text-foreground placeholder:text-muted-2 focus:outline-none"
          />
          <textarea
            ref={area}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onSelect={(e) => setSel({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })}
            placeholder="Start writing…"
            className="min-h-[62vh] w-full resize-none bg-transparent text-[15.5px] leading-[1.75] text-foreground placeholder:text-muted-2 focus:outline-none"
          />
        </GlassCard>

        <GlassCard hover={false} className="p-5 lg:sticky lg:top-[76px]">
          <div className="flex items-center gap-2">
            <Wand2 size={15} className="text-accent" />
            <p className="text-[14px] font-semibold text-foreground">AI help</p>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            {hasSel ? `Working on the ${selWords} selected words.` : "Select some text to work on just that part, or it uses the whole document."}
          </p>

          <ModelPicker models={models} value={modelId} onChange={setModelId} disabled={!!busy} className="mt-3" />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {ACTIONS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => run(key, label)}
                disabled={!!busy || !modelId}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[12.5px] text-foreground transition hover:border-accent/50 hover:bg-accent/[0.06] disabled:opacity-50",
                  busy === key && "border-accent/50"
                )}
              >
                {busy === key && <Loader2 size={12} className="animate-spin" />}
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              run("custom", "");
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Or tell it what to do…"
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-tint/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
            />
            <button
              disabled={!!busy || !instruction.trim() || !modelId}
              aria-label="Run instruction"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-dim disabled:opacity-40"
            >
              {busy === "custom" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            </button>
          </form>

          {busy && <p className="mt-3 text-[12px] text-muted">Thinking… long documents can take up to a minute.</p>}
          {error && <p className="mt-3 text-[12.5px] leading-snug text-rose">{error}</p>}

          {undo !== null && !result && !busy && (
            <button
              onClick={() => {
                setContent(undo);
                setUndo(null);
              }}
              className="mt-3 flex items-center gap-1.5 text-[12px] text-muted hover:text-foreground"
            >
              <Undo2 size={12} /> Undo the last AI change
            </button>
          )}

          {result && (
            <div className="mt-4 rounded-xl border border-hairline bg-tint/[0.02] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                  {result.label} · {result.model}
                </p>
                <button onClick={() => setResult(null)} aria-label="Discard" className="text-muted-2 hover:text-foreground">
                  <X size={13} />
                </button>
              </div>
              <div className="scrollbar-thin max-h-[42vh] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{result.text}</div>
              <Sources urls={result.sources} />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {isFeedback ? (
                  <button onClick={() => navigator.clipboard.writeText(result.text)} className="rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-muted hover:text-foreground">
                    Copy feedback
                  </button>
                ) : isContinue ? (
                  <button onClick={() => apply("append")} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim">
                    Add to the end
                  </button>
                ) : (
                  <>
                    <button onClick={() => apply("replace")} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-dim">
                      {result.partial ? "Replace selection" : "Replace document"}
                    </button>
                    <button onClick={() => apply("insert")} className="rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-muted hover:text-foreground">
                      Insert below
                    </button>
                  </>
                )}
                <button onClick={() => setResult(null)} className="rounded-lg px-2.5 py-1.5 text-[12px] text-muted-2 hover:text-foreground">
                  {isFeedback ? "Dismiss" : "Discard"}
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
