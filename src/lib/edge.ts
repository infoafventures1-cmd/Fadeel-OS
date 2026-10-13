// Daily Edge: shared types and constants (safe for the browser; no secrets here).

export type TopicKey = "ai_finance" | "fundamentals" | "ai_economics" | "africa";

export interface Topic {
  key: TopicKey;
  label: string;
  short: string;
  /** Initial weight (percent). Editable in Settings; a ranking preference, not a quota. */
  weight: number;
  /** Words that suggest an item belongs here. Used for the first, cheap relevance pass. */
  keywords: string[];
  /** Search queries used for discovery when a search key is set */
  queries: string[];
}

export const TOPICS: Topic[] = [
  {
    key: "ai_finance",
    label: "AI applied to finance",
    short: "AI × finance",
    weight: 40,
    keywords: ["bank", "banking", "payment", "payments", "lending", "loan", "credit", "fraud", "underwriting", "fintech", "trading", "wealth", "insurer", "insurance", "compliance", "kyc", "aml", "financial research", "automation", "agentic", "ai", "machine learning", "llm", "generative"],
    queries: ["AI fraud detection banks", "generative AI banking", "AI credit underwriting lending", "AI payments fintech", "AI agents financial services automation", "AI financial research analysts"],
  },
  {
    key: "fundamentals",
    label: "Finance fundamentals",
    short: "Fundamentals",
    weight: 25,
    keywords: ["earnings", "revenue", "profit", "margin", "cash flow", "free cash flow", "balance sheet", "income statement", "valuation", "multiple", "interest rate", "rates", "yield", "bond", "central bank", "inflation", "guidance", "business model", "dividend", "buyback", "debt"],
    queries: ["central bank interest rate decision", "quarterly earnings cash flow guidance", "company valuation explained", "bond yields interest rates"],
  },
  {
    key: "ai_economics",
    label: "AI business economics",
    short: "AI economics",
    weight: 20,
    keywords: ["capex", "data center", "datacenter", "gpu", "chips", "nvidia", "inference", "training cost", "compute", "pricing", "subscription", "startup", "funding", "valuation", "moat", "monetisation", "monetization", "openai", "anthropic", "hyperscaler", "cloud"],
    queries: ["AI infrastructure spending data centers capex", "AI inference costs pricing", "AI startup revenue funding round", "AI company monetization"],
  },
  {
    key: "africa",
    label: "African fintech, financial inclusion and climate finance",
    short: "Africa & climate",
    weight: 15,
    keywords: ["kenya", "nigeria", "africa", "african", "m-pesa", "mpesa", "safaricom", "mobile money", "financial inclusion", "unbanked", "climate finance", "green bond", "carbon", "cbk", "central bank of kenya", "flutterwave", "remittance"],
    queries: ["Kenya fintech", "African fintech funding", "mobile money financial inclusion Africa", "climate finance Africa", "Central Bank of Kenya"],
  },
];

export const topicByKey = (k: string) => TOPICS.find((t) => t.key === k);

export interface EdgeSettings {
  weights: Record<TopicKey, number>;
  /** "HH:MM" Africa/Nairobi. Used by the on-visit catch-up; the server schedule lives in vercel.json. */
  refreshTime: string;
  /** Discovery limits for one run */
  maxSearchQueries: number;
  maxCandidates: number;
  maxRetrieve: number;
  /** Hard stop for the month, in US dollars (AI + search) */
  monthlyCapUsd: number;
  synthModel: string;
  triageModel: string;
  weekly: boolean;
  /** Calls made with your own GEMINI_API_KEY on Google's free tier count as $0 toward the cap */
  geminiFreeTier: boolean;
}

export const DEFAULT_EDGE_SETTINGS: EdgeSettings = {
  weights: { ai_finance: 40, fundamentals: 25, ai_economics: 20, africa: 15 },
  refreshTime: "06:30",
  maxSearchQueries: 12,
  maxCandidates: 40,
  maxRetrieve: 10,
  monthlyCapUsd: 8,
  // Gemini Flash on Google's free tier keeps Daily Edge at $0 (about 2 AI calls a day)
  synthModel: "gemini",
  triageModel: "gemini",
  weekly: true,
  geminiFreeTier: true,
};

/** How much of an item we actually read. Shown on every card so nothing implies more than was retrieved. */
export type Access = "full" | "excerpt" | "headline" | "paywalled" | "video";

export const ACCESS_LABEL: Record<Access, string> = {
  full: "Full text read",
  excerpt: "Excerpt only",
  headline: "Headline and snippet only",
  paywalled: "Paywalled: teaser only",
  video: "Video: description only, no transcript",
};

/** What kind of evidence this is */
export type SourceType = "news" | "company" | "commentary" | "research" | "preliminary" | "official" | "filing" | "video";

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  news: "News report",
  company: "Company claim",
  commentary: "Commentary",
  research: "Research",
  preliminary: "Preliminary research",
  official: "Official publication",
  filing: "Filing",
  video: "Video",
};

export interface EdgeItem {
  id: string;
  url: string;
  title: string;
  publisher: string;
  domain: string;
  kind: "article" | "video";
  topic: TopicKey | null;
  sourceType: SourceType;
  access: Access;
  /** ISO instants / days. Publication, the event itself, and when we fetched it are tracked separately. */
  publishedAt: string | null;
  eventDate: string | null;
  retrievedAt: string | null;
  snippet: string;
  words: number;
  evergreen: boolean;
  /** Video only */
  channel?: string;
  durationMin?: number | null;
  thumbnail?: string | null;
  savedAt: string | null;
  readAt: string | null;
  takeaway: string;
  extras: { simple?: string; connect?: { economics: string; math: string } };
}

export type Lever = "costs" | "revenue" | "competition" | "incentives" | "risk";

export interface Story {
  id: string;
  /** The item the card links to (original source preferred) */
  itemId: string;
  /** Independent sources reporting the same event */
  corroboratingIds: string[];
  /** Copies of the same report on other sites: listed, never counted as corroboration */
  syndicatedIds: string[];
  topic: TopicKey;
  sourceType: SourceType;
  whatHappened: string;
  whyItMatters: string;
  mechanism: { lever: Lever; text: string }[];
  established: string[];
  interpretation: string[];
  uncertain: string[];
  question: string;
  recall: { q: string; a: string } | null;
  eventDate: string | null;
  /** Set when we could not read the full text */
  accessNote: string | null;
  /** Statements the grounding check removed because their figures were not in the sources */
  removed: number;
  /** Short key for the underlying event, used to avoid covering it again on later days */
  event?: string;
}

export interface Concept {
  title: string;
  plain: string;
  example: { setup: string; steps: string[]; result: string };
  diagram: { caption: string; nodes: string[] } | null;
  recall: { q: string; a: string } | null;
}

export interface BriefingData {
  stories: Story[];
  deepRead: { itemId: string; why: string; minutes: number; optional: boolean } | null;
  concept: Concept | null;
  video: { itemId: string; why: string; optional: boolean } | null;
  exercise: { prompt: string; hint: string; answer: string } | null;
  notes: string[];
  sourceFailures: { name: string; error: string }[];
  coreMinutes: number;
  generatedAt: string;
  model: string;
}

export interface WeeklyData {
  connections: { title: string; text: string; itemIds: string[] }[];
  disagreement: { title: string; text: string; itemIds: string[] } | null;
  hypothesis: string;
  experiment: string;
  generatedAt: string;
}

export const READ_WPM = 230;
export const minutesFor = (words: number) => Math.max(1, Math.round(words / READ_WPM));
