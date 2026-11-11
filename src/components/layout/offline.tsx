"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloudUpload, Loader2, WifiOff } from "lucide-react";
import { flush, outbox } from "@/lib/offline/outbox";
import { runStored } from "@/lib/offline/actions";

// Pages saved for offline use whenever the app is open with internet (at most every 2 hours)
const WARM = [
  "/home", "/edge", "/edge?tab=explore", "/edge?tab=saved", "/edge?tab=history", "/today", "/tasks", "/calendar",
  "/docs", "/plans", "/assistant", "/academics/school", "/academics/applications", "/academics/exams", "/academics/notes", "/settings",
  "/timetable.png",
];
const WARM_KEY = "fos-warmed-at";
// set after changes sync, so the saved offline copies are refreshed with them
let forceWarm = false;

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

/** Registers the offline service worker; downloads main pages for offline use; forgets them on the sign-in page */
export function OfflineSupport() {
  const pathname = usePathname();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      const sw = reg.active;
      if (!sw) return;
      if (pathname === "/login") {
        sw.postMessage({ type: "clear" });
        try {
          localStorage.removeItem(WARM_KEY);
        } catch {}
        return;
      }
      if (!navigator.onLine || pathname === "/setup") return;
      let last = 0;
      try {
        last = Number(localStorage.getItem(WARM_KEY) ?? 0);
      } catch {}
      // every 2 hours at most, and never in Low Data Mode
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      if ((Date.now() - last < 2 * 60 * 60_000 || saveData) && !forceWarm) return;
      forceWarm = false;
      try {
        localStorage.setItem(WARM_KEY, String(Date.now()));
      } catch {}
      // after the page has settled, so it doesn't compete with what you're looking at
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      setTimeout(() => (idle ? idle(() => sw.postMessage({ type: "warm", paths: WARM }), { timeout: 10_000 }) : sw.postMessage({ type: "warm", paths: WARM })), 8000);
    });
  }, [pathname]);
  return null;
}

const useOutbox = () => useSyncExternalStore(outbox.subscribe, outbox.list, outbox.serverList);

/**
 * Sends changes made offline once the connection is back, then refreshes the page.
 * Also shows a slim banner: offline, changes waiting, syncing, or changes the server didn't accept.
 */
export function OfflineBanner() {
  const online = useOnline();
  const entries = useOutbox();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const waiting = entries.filter((e) => !e.error);
  const failed = entries.filter((e) => e.error);

  useEffect(() => {
    if (!online || !waiting.length) return;
    let stop = false;
    const go = async () => {
      // read the live connection state: right after a page loads, the rendered value can briefly lag
      if (stop || !navigator.onLine) return;
      setSyncing(true);
      const r = await flush(runStored);
      setSyncing(false);
      if (r.sent) {
        forceWarm = true;
        router.refresh();
        navigator.serviceWorker?.ready.then((reg) => {
          try {
            localStorage.removeItem(WARM_KEY);
          } catch {}
          reg.active?.postMessage({ type: "warm", paths: WARM });
        });
      }
      // a page opened from the offline copy can carry an older version of the app; reload once and try again
      const stuck = outbox.list().some((e) => !e.error && e.attempts > 0);
      if (stuck && sessionStorage.getItem("fos-sync-reloaded") !== "1") {
        sessionStorage.setItem("fos-sync-reloaded", "1");
        location.reload();
      }
    };
    go();
    const t = setInterval(go, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // re-run when the number waiting changes or the connection comes back
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, waiting.length]);

  useEffect(() => {
    if (online && !entries.length) sessionStorage.removeItem("fos-sync-reloaded");
  }, [online, entries.length]);

  if (online && !entries.length) return null;
  const n = waiting.length;
  const changes = (k: number) => `${k} change${k === 1 ? "" : "s"}`;
  const tone = failed.length ? "border-rose/30 bg-rose/[0.08] text-rose" : "border-amber/30 bg-amber/[0.12] text-amber";

  return (
    <div role="status" className={`border-b px-4 py-2 text-[12.5px] font-medium ${tone}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        {!online ? <WifiOff size={14} /> : syncing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
        <span>
          {!online
            ? n
              ? `You're offline. ${changes(n)} saved on this phone will sync when you're back online.`
              : "You're offline. Changes you make are saved on this phone and sync when you're back online."
            : n
              ? `Syncing ${changes(n)} made offline…`
              : ""}
          {failed.length ? ` ${changes(failed.length)} couldn't sync.` : ""}
        </span>
        {entries.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} className="underline underline-offset-2">
            {open ? "Hide" : "See changes"}
          </button>
        )}
      </div>
      {open && entries.length > 0 && (
        <ul className="mx-auto mt-2 max-w-[560px] space-y-1 text-left font-normal text-foreground">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-lg bg-background/70 px-3 py-1.5 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate">{e.label}</span>
              <span className="shrink-0 text-[11px] text-muted-2">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              {e.error ? (
                <>
                  <button onClick={() => outbox.update(e.id, { error: undefined, attempts: 0 })} className="shrink-0 text-[11.5px] font-medium text-accent">
                    Retry
                  </button>
                  <button onClick={() => outbox.remove(e.id)} className="shrink-0 text-[11.5px] text-muted">
                    Discard
                  </button>
                </>
              ) : (
                <span className="shrink-0 text-[11px] text-muted-2">waiting</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
