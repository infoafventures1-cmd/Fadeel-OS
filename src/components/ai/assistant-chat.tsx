"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, Loader2, RotateCcw } from "lucide-react";
import { ASSISTANT_NAME, OWNER } from "@/config";
import { askAI, ModelPicker, Sources, useModelChoice, type ModelInfo } from "./model-picker";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  model?: string;
  sources?: string[];
  error?: boolean;
}

const STARTERS = [
  "What should I focus on today?",
  "Help me plan this week around my deadlines",
  "Explain a topic I'm studying, simply",
  "Give me 5 startup ideas for students in Mombasa",
];

/** The assistant chat. Used full-page on /assistant and in the floating window on every page. */
export function AssistantChat({ compact = false }: { compact?: boolean }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [history, setHistory] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modelId, setModelId] = useModelChoice(models);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d: { models?: ModelInfo[]; history?: Msg[] }) => {
        setModels(d.models ?? []);
        setHistory(d.history ?? []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [history, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !modelId) return;
    setBusy(true);
    setDraft("");
    setHistory((h) => [...h, { role: "user", content: message }]);
    try {
      const r = await askAI<{ history: Msg[] }>({ task: "chat", modelId, message });
      setHistory(r.history);
    } catch (e) {
      setHistory((h) => [...h, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    setConfirmClear(false);
    const r = await askAI<{ history: Msg[] }>({ task: "chat-clear" }).catch(() => null);
    if (r) setHistory(r.history);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex flex-wrap items-center gap-2 border-b border-hairline", compact ? "p-3" : "p-4")}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Bot size={15} />
        </span>
        <p className="text-[14px] font-semibold text-foreground">{ASSISTANT_NAME}</p>
        <button
          onClick={clear}
          disabled={busy || !history.length}
          className={cn("ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] transition disabled:opacity-40", confirmClear ? "text-rose" : "text-muted-2 hover:text-foreground")}
        >
          <RotateCcw size={11} /> {confirmClear ? "Clear the chat?" : "New chat"}
        </button>
        <ModelPicker models={models} value={modelId} onChange={setModelId} disabled={busy} className="w-full" />
      </div>

      <div ref={box} className={cn("scrollbar-thin flex flex-1 flex-col gap-3 overflow-y-auto", compact ? "p-3" : "p-5")}>
        {!loaded ? (
          <p className="text-[12.5px] text-muted-2">Loading…</p>
        ) : history.length === 0 ? (
          <div className="my-auto py-6 text-center">
            <p className="text-[20px] font-semibold text-foreground">
              Hi {OWNER.firstName}. What&apos;s <em className="serif-accent">on your mind</em>?
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">It can see your open tasks, plans and documents.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy || !modelId}
                  className="rounded-full border border-hairline px-3 py-1.5 text-[12.5px] text-foreground transition hover:border-accent/50 hover:bg-accent/[0.06] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13.5px] leading-relaxed text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className="max-w-[90%] self-start rounded-2xl rounded-bl-md bg-tint/[0.05] px-3.5 py-2.5">
                {m.model && <p className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">{m.model}</p>}
                <p className={cn("whitespace-pre-wrap text-[13.5px] leading-relaxed", m.error ? "text-rose" : "text-foreground")}>{m.content}</p>
                <Sources urls={m.sources} />
              </div>
            )
          )
        )}
        {busy && (
          <div className="flex items-center gap-2 self-start rounded-2xl bg-tint/[0.05] px-3.5 py-2 text-[12.5px] text-muted">
            <Loader2 size={13} className="animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className={cn("border-t border-hairline", compact ? "p-2.5" : "p-4")}
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
            rows={compact ? 1 : 2}
            placeholder={`Message ${ASSISTANT_NAME}…`}
            className="max-h-40 min-w-0 flex-1 resize-none bg-transparent text-[13.5px] text-foreground placeholder:text-muted-2 focus:outline-none"
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
    </div>
  );
}
