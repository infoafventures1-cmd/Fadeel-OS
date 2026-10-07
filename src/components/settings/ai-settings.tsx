"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { askAI, type ModelInfo } from "@/components/ai/model-picker";

const PROVIDER = { anthropic: "Claude", openai: "ChatGPT", google: "Gemini", perplexity: "Perplexity" } as const;

type Test = { state: "running" } | { state: "ok"; ms: number; via: string } | { state: "fail"; error: string };

export function AiSettings({ models }: { models: ModelInfo[] }) {
  const [tests, setTests] = useState<Record<string, Test>>({});

  async function test(id: string) {
    setTests((t) => ({ ...t, [id]: { state: "running" } }));
    try {
      const r = await askAI<{ ok: boolean; ms?: number; via?: string; error?: string }>({ task: "ping", modelId: id });
      setTests((t) => ({ ...t, [id]: r.ok ? { state: "ok", ms: r.ms ?? 0, via: r.via ?? "" } : { state: "fail", error: r.error ?? "Failed" } }));
    } catch (e) {
      setTests((t) => ({ ...t, [id]: { state: "fail", error: e instanceof Error ? e.message : "Failed" } }));
    }
  }

  return (
    <div className="divide-y divide-hairline">
      {models.map((m) => {
        const t = tests[m.id];
        return (
          <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]">
            {m.ready ? <CheckCircle2 size={14} className="shrink-0 text-emerald" /> : <Circle size={14} className="shrink-0 text-muted-2" />}
            <span className="min-w-0 flex-1">
              <span className="text-foreground">{m.label}</span>
              <span className="ml-2 text-[11.5px] text-muted-2">{PROVIDER[m.provider]}</span>
            </span>
            {!m.ready ? (
              <span className="text-[12px] text-muted-2">Not connected</span>
            ) : (
              <>
                {t?.state === "ok" && <span className="font-mono text-[11px] text-emerald">works · {(t.ms / 1000).toFixed(1)}s{t.via === "openrouter" ? " · via OpenRouter" : ""}</span>}
                <button
                  onClick={() => test(m.id)}
                  disabled={t?.state === "running"}
                  className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-[12px] text-muted hover:text-foreground disabled:opacity-60"
                >
                  {t?.state === "running" && <Loader2 size={11} className="animate-spin" />} Test
                </button>
              </>
            )}
            {t?.state === "fail" && (
              <p className="flex w-full items-start gap-1.5 pl-[26px] text-[12px] leading-snug text-rose">
                <XCircle size={12} className="mt-0.5 shrink-0" /> {t.error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
