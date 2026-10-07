// Everything personal lives in this one file. Change it and the whole dashboard follows.

/** Shown in the sidebar, the browser tab and the login screen. The last word is drawn in the accent colour. */
export const APP_NAME = "FADEEL OS";

export const OWNER = {
  /** Used in the greeting: "Good morning, <firstName>." */
  firstName: "Fadeel",
  fullName: "Fadeel",
  /** The Google account the Mail, Calendar and Drive links open in */
  email: "notta.fadeel@gmail.com",
};

/** IANA timezone name. Due dates, "today" and the planner all follow this clock. */
export const TIMEZONE = "Africa/Nairobi";

/** Weather chip on Home (Open-Meteo, a free public service that needs no account or key). Set to null to hide it. */
export const WEATHER: { city: string; latitude: number; longitude: number } | null = {
  city: "Mombasa",
  latitude: -4.0435,
  longitude: 39.6682,
};

export interface Project {
  key: string;
  name: string;
  color: string;
  /** Words that file a task under this project when you type it into Quick Capture */
  keywords?: RegExp;
}

/** The buckets tasks are filed under. Keep "personal": it is the default when nothing else matches. */
export const PROJECTS: Project[] = [
  { key: "school", name: "School", color: "#7a5fb0", keywords: /homework|\bhw\b|revis|exam|\btest\b|quiz|essay|assignment|school|class|teacher|lesson|study|\bia\b|\bee\b|\btok\b|\bcas\b|university|uni app/ },
  { key: "business", name: "Business", color: "#3b7489", keywords: /\bbusiness\b|client|meeting|invoice|proposal|pitch|investor|customer|sales|business plan/ },
  { key: "side", name: "Side Projects", color: "#ff5a1f", keywords: /side project|\bapp\b|website|prototype|launch|startup/ },
  { key: "finance", name: "Finance", color: "#2e6b4f", keywords: /money|finance|invest|budget|bank|\bpay\b|\bkes\b|mpesa|m-pesa/ },
  { key: "personal", name: "Personal", color: "#6c6c63" },
];

export const projectByKey = (key: string) => PROJECTS.find((p) => p.key === key);

const google = (url: string) => `${url}?authuser=${encodeURIComponent(OWNER.email)}`;

/** Shortcuts on Home. These are plain links that open in a new tab. */
export const QUICK_LINKS: { label: string; url: string }[] = [
  { label: "Mail", url: google("https://mail.google.com/mail/") },
  { label: "Calendar", url: google("https://calendar.google.com/calendar/") },
  { label: "Drive", url: google("https://drive.google.com/drive/") },
  { label: "Docs", url: google("https://docs.google.com/document/") },
  { label: "GitHub", url: "https://github.com" },
  { label: "Vercel", url: "https://vercel.com" },
];

/* ---------------- AI ---------------- */

/** The name of the chat assistant (sidebar, chat window, greeting). */
export const ASSISTANT_NAME = "Assistant";

export type AiProvider = "anthropic" | "openai" | "google" | "perplexity";

export interface AiModel {
  /** Our own short key, stored in the browser when you pick a model */
  id: string;
  label: string;
  provider: AiProvider;
  /** The model id the provider's own API expects (used when that provider's key is set) */
  model: string;
  /** The same model's id on OpenRouter (used when only OPENROUTER_API_KEY is set) */
  openrouter: string;
  /** One line shown under the picker */
  note?: string;
}

/**
 * The models in every AI picker. Each one works when EITHER its provider's own key is set
 * (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, PERPLEXITY_API_KEY) OR one OPENROUTER_API_KEY
 * is set, which covers all of them. Model ids change often: Settings › AI models has a Test button
 * that tells you which ones answer, and you fix a broken one by editing its id here.
 */
export const AI_MODELS: AiModel[] = [
  { id: "claude", label: "Claude Sonnet", provider: "anthropic", model: "claude-sonnet-5-5", openrouter: "anthropic/claude-sonnet-5.5", note: "Best all-round writer" },
  { id: "claude-opus", label: "Claude Opus", provider: "anthropic", model: "claude-opus-5-5", openrouter: "anthropic/claude-opus-5.5", note: "Most capable, slower" },
  { id: "claude-haiku", label: "Claude Haiku", provider: "anthropic", model: "claude-haiku-4-5-20251001", openrouter: "anthropic/claude-haiku-4.5", note: "Fast and cheap" },
  { id: "gpt", label: "ChatGPT (GPT-5.5)", provider: "openai", model: "gpt-5.5", openrouter: "openai/gpt-5.5" },
  { id: "gpt-mini", label: "ChatGPT (GPT-4.1 mini)", provider: "openai", model: "gpt-4.1-mini", openrouter: "openai/gpt-4.1-mini", note: "Fast and cheap" },
  { id: "gemini", label: "Gemini Flash", provider: "google", model: "gemini-3.8-flash", openrouter: "google/gemini-3.8-flash" },
  { id: "perplexity", label: "Perplexity Sonar Pro", provider: "perplexity", model: "sonar-pro", openrouter: "perplexity/sonar-pro", note: "Searches the web and cites sources" },
  { id: "perplexity-fast", label: "Perplexity Sonar", provider: "perplexity", model: "sonar", openrouter: "perplexity/sonar", note: "Web search, faster" },
];
