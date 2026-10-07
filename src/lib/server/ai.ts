// Server-only: every AI call goes through here so API keys never reach the browser.
// One function, complete(), talks to Claude, ChatGPT, Gemini or Perplexity, either directly
// (when that company's key is set) or through OpenRouter (one key that covers all of them).
import { AI_MODELS, type AiModel, type AiProvider } from "@/config";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface AiResult {
  text: string;
  sources: string[];
  via: "direct" | "openrouter";
}

export class AiError extends Error {}

const KEY_ENV: Record<AiProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

const env = (k: string) => (process.env[k] ?? "").trim();

function route(m: AiModel): "direct" | "openrouter" | null {
  if (env(KEY_ENV[m.provider])) return "direct";
  if (env("OPENROUTER_API_KEY")) return "openrouter";
  return null;
}

/** The model list with whether each can run right now. Safe to send to the browser (no keys). */
export function modelStatus() {
  return AI_MODELS.map((m) => ({ id: m.id, label: m.label, provider: m.provider, note: m.note ?? "", ready: route(m) !== null }));
}
export type ModelStatus = ReturnType<typeof modelStatus>[number];

/** Strict APIs want turns that alternate and start with the user. */
function normalize(messages: ChatMsg[]) {
  const out: ChatMsg[] = [];
  for (const m of messages) {
    const content = String(m.content ?? "").trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + content;
    else if (out.length || m.role === "user") out.push({ role: m.role, content });
  }
  if (!out.length || out[out.length - 1].role !== "user") throw new AiError("There's no question to send.");
  return out;
}

function explain(status: number, body: unknown, who: string) {
  const j = body as { error?: { message?: string } | string; message?: string };
  const msg = typeof j?.error === "string" ? j.error : j?.error?.message ?? j?.message ?? "";
  if (status === 401 || status === 403) return `${who} rejected the API key. Check it in Vercel › Settings › Environment Variables.`;
  if (status === 402) return `${who} says the account is out of credit.`;
  if (status === 404 || /model/i.test(msg)) return `${who} doesn't recognise this model id. Update it in src/config.ts. (${msg.slice(0, 160)})`;
  if (status === 429) return `${who} is rate-limiting you. Wait a minute and try again.`;
  return `${who} error ${status}${msg ? `: ${msg.slice(0, 200)}` : ""}`;
}

async function post(url: string, headers: Record<string, string>, body: unknown, who: string) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(115_000),
    });
  } catch (e) {
    throw new AiError(e instanceof Error && e.name === "TimeoutError" ? `${who} took too long to answer. Try a faster model or ask for less.` : `Couldn't reach ${who}.`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(explain(res.status, json, who));
  return json as Record<string, unknown>;
}

/** OpenAI, Gemini, Perplexity and OpenRouter all speak the OpenAI chat-completions format. */
async function openaiStyle(url: string, key: string, model: string, system: string, messages: ChatMsg[], who: string, extra: Record<string, string> = {}) {
  const j = await post(url, { Authorization: `Bearer ${key}`, ...extra }, { model, messages: [{ role: "system", content: system }, ...messages] }, who);
  const choice = (j.choices as { message?: { content?: unknown; annotations?: { url_citation?: { url?: string } }[] } }[] | undefined)?.[0];
  const content = choice?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p: { text?: string }) => p?.text ?? "").join("") : "";
  const sources = [
    ...((j.citations as string[] | undefined) ?? []),
    ...((j.search_results as { url?: string }[] | undefined) ?? []).map((r) => r.url ?? ""),
    ...(choice?.message?.annotations ?? []).map((a) => a?.url_citation?.url ?? ""),
  ].filter((u, i, all) => u && all.indexOf(u) === i);
  return { text, sources };
}

async function anthropic(key: string, model: string, system: string, messages: ChatMsg[]) {
  const j = await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
    { model, max_tokens: 8000, system, messages },
    "Anthropic"
  );
  const text = ((j.content as { type: string; text?: string }[] | undefined) ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  return { text, sources: [] as string[] };
}

export async function complete(modelId: string, system: string, messages: ChatMsg[]): Promise<AiResult> {
  const m = AI_MODELS.find((x) => x.id === modelId);
  if (!m) throw new AiError("Unknown model.");
  const via = route(m);
  if (!via) throw new AiError(`${m.label} isn't connected yet. Add ${KEY_ENV[m.provider]} or OPENROUTER_API_KEY in Vercel, then redeploy.`);
  const msgs = normalize(messages);

  let out: { text: string; sources: string[] };
  if (via === "openrouter") {
    out = await openaiStyle("https://openrouter.ai/api/v1/chat/completions", env("OPENROUTER_API_KEY"), m.openrouter, system, msgs, "OpenRouter", { "X-Title": "FADEEL OS" });
  } else if (m.provider === "anthropic") {
    out = await anthropic(env(KEY_ENV.anthropic), m.model, system, msgs);
  } else if (m.provider === "openai") {
    out = await openaiStyle("https://api.openai.com/v1/chat/completions", env(KEY_ENV.openai), m.model, system, msgs, "OpenAI");
  } else if (m.provider === "google") {
    out = await openaiStyle("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", env(KEY_ENV.google), m.model, system, msgs, "Google Gemini");
  } else {
    out = await openaiStyle("https://api.perplexity.ai/chat/completions", env(KEY_ENV.perplexity), m.model, system, msgs, "Perplexity");
  }
  if (!out.text.trim()) throw new AiError(`${m.label} sent back an empty answer. Try again or pick another model.`);
  return { ...out, via };
}

/** Read a JSON object out of a reply that may have a sentence or a code fence around it. */
export function looseJson(t: string): Record<string, unknown> | null {
  const tries = [t, t.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? "", (() => { const a = t.indexOf("{"), b = t.lastIndexOf("}"); return a >= 0 && b > a ? t.slice(a, b + 1) : ""; })()];
  for (const s of tries) {
    if (!s) continue;
    try {
      const v = JSON.parse(s);
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch {}
  }
  return null;
}
