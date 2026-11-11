"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";

// Pages saved for offline use whenever the app is open with internet (at most every 30 minutes)
const WARM = [
  "/home", "/edge", "/edge?tab=explore", "/edge?tab=saved", "/edge?tab=history", "/today", "/tasks", "/calendar",
  "/docs", "/plans", "/assistant", "/academics/school", "/academics/applications", "/academics/exams", "/academics/notes", "/settings",
  "/timetable.png",
];
const WARM_KEY = "fos-warmed-at";

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
      if (Date.now() - last < 30 * 60_000) return;
      try {
        localStorage.setItem(WARM_KEY, String(Date.now()));
      } catch {}
      // after the page has settled, so it doesn't compete with what you're looking at
      setTimeout(() => sw.postMessage({ type: "warm", paths: WARM }), 4000);
    });
  }, [pathname]);
  return null;
}

/** A slim banner while offline */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-amber/30 bg-amber/[0.12] px-4 py-2 text-[12.5px] font-medium text-amber">
      <WifiOff size={14} /> You&apos;re offline: showing your saved copy. Changes won&apos;t save until you&apos;re back online.
    </div>
  );
}
