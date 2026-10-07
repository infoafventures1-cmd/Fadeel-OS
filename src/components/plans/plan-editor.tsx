"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Download, Trash2, Plus, X, Loader2, Undo2, ArrowUp, GraduationCap } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { deletePlanAction, saveBusinessPlanAction } from "@/app/actions";
import { askAI, ModelPicker, Sources, useModelChoice, type ModelInfo } from "@/components/ai/model-picker";
import { PLAN_HINT, planToMarkdown, sectionId, type Plan, type PlanChatMsg, type PlanSection } from "@/lib/plan-template";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Draft the whole plan from my idea",
  "Research competitors in Kenya",
  "Make the financials realistic in KES",
  "What would a judge criticise?",
  "Tighten the executive summary",
];

interface PlanReply {
  title: string;
  sections: PlanSection[];
  chat: PlanChatMsg[];
  changed: string[];
  count: number;
}

export function PlanEditor({ plan, models }: { plan: Plan; models: ModelInfo[] }) {
  const [title, setTitle] = useState(plan.title);
  const [idea, setIdea] = useState(plan.idea);
  const [sections, setSections] = useState<PlanSection[]>(plan.sections);
  const [chat, setChat] = useState<PlanChatMsg[]>(plan.chat);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [copied, setCopied] = useState(false);
  const [confirmSec, setConfirmSec] = useState<string | null>(null);
  const [, start] = useTransition();

  const [modelId, setModelId] = useModelChoice(models);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ sections: PlanSection[]; title: string; count: number } | null>(null);

  const first = useRef(true);
  const docRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  // autosave a moment after typing stops
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("unsaved");
    const t = setTimeout(async () => {
      setStatus("saving");
      await saveBusinessPlanAction(plan.id, title, idea, sections);
      setStatus("saved");
    }, 900);
    return () => clearTimeout(t);
  }, [title, idea, sections, plan.id]);

  // section boxes grow with their text
  useLayoutEffect(() => {
    docRef.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-grow]").forEach((t) => {
      t.style.height = "auto";
      t.style.height = t.scrollHeight + "px";
    });
  }, [sections]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight });
  }, [chat, busy]);

  const filled = sections.filter((s) => s.content.trim()).length;
  const words = sections.reduce((n, s) => n + (s.content.trim() ? s.content.trim().split(/\s+/).length : 0), 0);
  const setSection = (id: string, patch: Partial<PlanSection>) => setSections((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !modelId) return;
    const before = { sections, title };
    setBusy(true);
    setDraft("");
    setChat((c) => [...c, { role: "user", content: message }]);
    try {
      const r = await askAI<PlanReply>({ task: "plan", id: plan.id, modelId, message, title, idea, sections });
      first.current = true; // the server already saved this version
      setTitle(r.title);
      setSections(r.sections);
      setChat(r.chat);
      setChanged(new Set(r.changed));
      setUndo(r.count ? { ...before, count: r.count } : null);
      setStatus("saved");
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  const md = planToMarkdown({ title, idea, sections });

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/plans" className="flex items-center gap-1 text-[12.5px] text-muted hover:text-foreground">
          <ArrowLeft size={13} /> Plans
        </Link>
        <span className="ml-auto font-mono text-[11px] text-muted-2">
          {filled}/{sections.length} sections · {words} words · {status === "saved" ? "saved" : status === "saving" ? "saving…" : "unsaved"}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(md);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-muted hover:text-foreground"
        >
          {copied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />} Copy
        </button>
        <a
          href={`data:text/markdown;charset=utf-8,${encodeURIComponent(md)}`}
          download={`${title.replace(/[^\w\- ]+/g, "").trim() || "business-plan"}.md`}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-muted hover:text-foreground"
        >
          <Download size={12} /> Download
        </a>
        <button
          onClick={() => confirm(`Delete the plan “${title}”? This can't be undone.`) && start(() => deletePlanAction(plan.id))}
          aria-label="Delete plan"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-hairline text-muted-2 hover:text-rose"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---- the plan ---- */}
        <GlassCard hover={false} className="p-6 sm:p-9">
          <div ref={docRef} className="mx-auto max-w-[700px]">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled plan"
              readOnly={busy}
              className="w-full bg-transparent font-[family-name:var(--font-display)] text-[30px] font-semibold tracking-tight text-foreground placeholder:text-muted-2 focus:outline-none"
            />
            <label className="mt-3 block">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-2">The idea</span>
              <input
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="One line: what it does and for whom"
                readOnly={busy}
                className="mt-1 w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-2 focus:outline-none"
              />
            </label>

            <div className="mt-8 space-y-8">
              {sections.map((s) => (
                <section key={s.id} className="group">
                  <div className="flex items-center gap-2">
                    <input
                      value={s.title}
                      onChange={(e) => setSection(s.id, { title: e.target.value })}
                      readOnly={busy}
                      aria-label="Section title"
                      className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-display)] text-[19px] font-semibold tracking-tight text-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (s.content.trim() && confirmSec !== s.id) {
                          setConfirmSec(s.id);
                          setTimeout(() => setConfirmSec((c) => (c === s.id ? null : c)), 3500);
                          return;
                        }
                        setConfirmSec(null);
                        setSections((all) => all.filter((x) => x.id !== s.id));
                      }}
                      aria-label="Remove section"
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11.5px] transition",
                        confirmSec === s.id ? "text-rose" : "text-muted-2 opacity-0 hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                      )}
                    >
                      {confirmSec === s.id ? "Remove?" : <X size={13} />}
                    </button>
                  </div>
                  <textarea
                    data-grow
                    value={s.content}
                    onChange={(e) => setSection(s.id, { content: e.target.value })}
                    readOnly={busy}
                    rows={2}
                    placeholder={PLAN_HINT[s.title] ?? "Write this section…"}
                    className={cn(
                      "mt-1.5 w-full resize-none overflow-hidden rounded-lg bg-transparent px-0 text-[15px] leading-[1.75] text-foreground placeholder:text-muted-2/80 focus:outline-none",
                      changed.has(s.id) && "-mx-2 bg-accent/[0.07] px-2 transition-colors duration-1000"
                    )}
                  />
                </section>
              ))}
            </div>

            <button
              onClick={() => setSections((all) => [...all, { id: sectionId(), title: "New section", content: "" }])}
              disabled={busy}
              className="mt-8 flex items-center gap-1.5 rounded-lg border border-dashed border-tint/20 px-3 py-2 text-[12.5px] text-muted hover:text-foreground"
            >
              <Plus size={13} /> Add section
            </button>
          </div>
        </GlassCard>

        {/* ---- the AI co-writer ---- */}
        <GlassCard hover={false} className="flex h-[calc(100vh-150px)] min-h-[480px] flex-col overflow-hidden lg:sticky lg:top-[76px]">
          <div className="border-b border-hairline p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <GraduationCap size={15} className="text-accent" />
              <p className="text-[14px] font-semibold text-foreground">AI co-writer</p>
            </div>
            <ModelPicker models={models} value={modelId} onChange={setModelId} disabled={busy} />
          </div>

          <div ref={msgsRef} className="scrollbar-thin flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
            {chat.length === 0 && !busy && (
              <p className="text-[12.5px] leading-relaxed text-muted">
                Ask it to draft, research or rewrite any part of the plan. It writes straight into the doc on the left, and you can undo each change.
              </p>
            )}
            {chat.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="max-w-[90%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[13px] leading-relaxed text-white">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="max-w-[92%] self-start rounded-2xl rounded-bl-md bg-tint/[0.05] px-3 py-2">
                  {m.model && <p className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">{m.model}</p>}
                  <p className={cn("whitespace-pre-wrap text-[13px] leading-relaxed", m.error ? "text-rose" : "text-foreground")}>{m.content}</p>
                  <Sources urls={m.sources} />
                  {undo && i === chat.length - 1 && !busy && (
                    <button
                      onClick={() => {
                        setSections(undo.sections);
                        setTitle(undo.title);
                        setUndo(null);
                        setChanged(new Set());
                      }}
                      className="mt-2 flex items-center gap-1.5 rounded-lg border border-hairline px-2 py-1 text-[11.5px] text-muted hover:text-foreground"
                    >
                      <Undo2 size={11} /> Undo {undo.count} change{undo.count > 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              )
            )}
            {busy && (
              <div className="flex items-center gap-2 self-start rounded-2xl bg-tint/[0.05] px-3 py-2 text-[12.5px] text-muted">
                <Loader2 size={13} className="animate-spin" /> Working on the plan… a full draft can take a minute.
              </div>
            )}
          </div>

          {chat.length === 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy || !modelId}
                  className="rounded-full border border-hairline px-2.5 py-1 text-left text-[12px] text-foreground transition hover:border-accent/50 hover:bg-accent/[0.06] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="border-t border-hairline p-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-hairline bg-tint/[0.03] p-2 focus-within:border-accent/60">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                rows={2}
                placeholder="Ask anything, or tell it what to add…"
                className="max-h-40 min-w-0 flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-2 focus:outline-none"
              />
              <button
                disabled={busy || !draft.trim() || !modelId}
                aria-label="Send"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-dim disabled:opacity-40"
              >
                <ArrowUp size={15} />
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
