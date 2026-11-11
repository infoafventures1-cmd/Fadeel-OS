// Offline changes ("the outbox"). When there is no internet, a change is stored on this device instead of
// failing, and sent to the server in the original order once the connection is back.
// Browser-only module: it is imported by client components.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface OutboxEntry {
  id: string;
  name: string; // the server action's name
  args: Json[];
  label: string; // what the person did, in plain words
  key: string | null; // later changes with the same key replace earlier ones (e.g. autosaves of one document)
  at: number;
  attempts: number;
  error?: string;
}

const STORE = "fos-outbox";
const listeners = new Set<() => void>();
let cache: OutboxEntry[] | null = null;
const EMPTY: OutboxEntry[] = [];

function read(): OutboxEntry[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORE) ?? "[]") as OutboxEntry[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: OutboxEntry[]) {
  cache = list;
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {}
  listeners.forEach((l) => l());
}

export const outbox = {
  list: () => (typeof window === "undefined" ? EMPTY : read()),
  serverList: () => EMPTY,
  subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE) {
        cache = null;
        l();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  },
  add(entry: Omit<OutboxEntry, "id" | "at" | "attempts">) {
    const list = read().filter((e) => !(entry.key && e.key === entry.key && !e.error));
    // the id doubles as a one-time receipt number on the server, so it must be unique
    const id = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20);
    write([...list, { ...entry, id, at: Date.now(), attempts: 0 }]);
  },
  remove(id: string) {
    write(read().filter((e) => e.id !== id));
  },
  update(id: string, patch: Partial<OutboxEntry>) {
    write(read().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  },
};

/* ---------------- arguments: FormData is stored as its entries (rebuilt on the server) ---------------- */

export function pack(args: unknown[]): Json[] {
  return args.map((a) => (a instanceof FormData ? { __formdata: [...a.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]) } : (JSON.parse(JSON.stringify(a ?? null)) as Json)));
}

/** True for "couldn't reach the server" (no internet), not for an error the server returned */
export function isNetworkError(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /failed to fetch|load failed|network ?error|networkerror|fetch failed|the internet connection appears to be offline|err_internet_disconnected/i.test(msg);
}

/* ---------------- sending ---------------- */

type Runner = (id: string, name: string, args: Json[]) => Promise<unknown>;
let flushing: Promise<{ sent: number; failed: number }> | null = null;

/** Send waiting changes in order. Stops at the first network failure (still offline) and tries again later. */
export function flush(run: Runner) {
  flushing ??= (async () => {
    let sent = 0;
    let failed = 0;
    for (const entry of [...read()]) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      if (entry.error) continue; // waits for Retry or Discard
      try {
        await run(entry.id, entry.name, entry.args);
        outbox.remove(entry.id);
        sent++;
      } catch (e) {
        if (isNetworkError(e)) break;
        const attempts = entry.attempts + 1;
        // the server refused it: keep it, and after three tries ask the person what to do
        outbox.update(entry.id, { attempts, ...(attempts >= 3 ? { error: "The server didn't accept this change." } : {}) });
        if (attempts >= 3) failed++;
        else break;
      }
    }
    return { sent, failed };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
