"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModelInfo {
  id: string;
  label: string;
  provider: "anthropic" | "openai" | "google" | "perplexity";
  note: string;
  ready: boolean;
}

const GROUPS: [ModelInfo["provider"], string][] = [
  ["anthropic", "Claude"],
  ["openai", "ChatGPT"],
  ["google", "Gemini"],
  ["perplexity", "Perplexity"],
];

const KEY = "fos-model";

/** The chosen model, remembered in this browser and shared by every AI panel */
export function useModelChoice(models: ModelInfo[]) {
  const [id, setId] = useState("");
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(KEY) ?? "";
    } catch {}
    const pick = models.find((m) => m.id === saved && m.ready) ?? models.find((m) => m.ready) ?? models[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice once the list arrives
    setId(pick?.id ?? "");
  }, [models]);
  const choose = (v: string) => {
    setId(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  };
  return [id, choose] as const;
}

export function ModelPicker({
  models,
  value,
  onChange,
  disabled,
  className,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const current = models.find((m) => m.id === value);
  const anyReady = models.some((m) => m.ready);
  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || !anyReady}
          aria-label="AI model"
          className="w-full appearance-none rounded-lg border border-hairline bg-tint/[0.03] py-1.5 pl-2.5 pr-7 text-[12.5px] text-foreground focus:border-accent/60 focus:outline-none disabled:opacity-60"
        >
          {GROUPS.map(([p, name]) => {
            const list = models.filter((m) => m.provider === p);
            if (!list.length) return null;
            return (
              <optgroup key={p} label={name}>
                {list.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.ready}>
                    {m.label}
                    {m.ready ? "" : " (not connected)"}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-2" />
      </div>
      {!anyReady ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-amber">
          No AI is connected yet. <Link href="/settings#ai" className="underline">See how in Settings</Link>.
        </p>
      ) : current?.note ? (
        <p className="mt-1 text-[11px] text-muted-2">{current.note}</p>
      ) : null}
    </div>
  );
}

export function Sources({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u;
    }
  };
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
      {urls.slice(0, 8).map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-accent hover:underline">
          [{i + 1}] {host(u)}
        </a>
      ))}
    </div>
  );
}

/** POST to /api/ai and return the JSON, or throw with the server's plain-English error */
export async function askAI<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("You're offline, or the site couldn't be reached.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? (res.status === 401 ? "You've been signed out. Reload the page." : `Request failed (${res.status}).`));
  return json as T;
}
