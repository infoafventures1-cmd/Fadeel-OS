"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ArrowRight, CheckSquare, FileText, Zap, GraduationCap } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: string;
}

const PAGES: Result[] = NAV_ITEMS.map((n) => ({ id: `nav-${n.href}`, title: n.label, subtitle: "Go to page", href: n.href, icon: n.icon, group: "Navigate" }));

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [items, setItems] = useState<Result[]>([]);
  const router = useRouter();

  // Open tasks and documents, refreshed every time the palette opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/search")
      .then((r) => r.json())
      .then((d: { tasks?: { id: string; title: string; project: string }[]; docs?: { id: string; title: string }[]; plans?: { id: string; title: string }[] }) => {
        if (cancelled || !d.tasks) return;
        setItems([
          ...d.tasks.map((t) => ({ id: `task-${t.id}`, title: t.title, subtitle: `Task · ${t.project}`, href: "/tasks", icon: CheckSquare, group: "Tasks" })),
          ...(d.docs ?? []).map((doc) => ({ id: `doc-${doc.id}`, title: doc.title, subtitle: "Document", href: `/docs/${doc.id}`, icon: FileText, group: "Documents" })),
          ...(d.plans ?? []).map((p) => ({ id: `plan-${p.id}`, title: p.title, subtitle: "University plan", href: `/plans/${p.id}`, icon: GraduationCap, group: "Plans" })),
        ]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return PAGES;
    const index = [...PAGES, ...items];
    const q = query.toLowerCase();
    return index.filter((r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)).slice(0, 10);
  }, [query, items]);

  function go(r: Result) {
    router.push(r.href);
    onClose();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection when the result set changes
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results[activeIndex]) go(results[activeIndex]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="glass w-full max-w-[560px] overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3.5">
              <Search size={16} className="text-muted-2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks, documents and pages…"
                className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-2 focus:outline-none"
              />
              <kbd className="rounded border border-hairline bg-tint/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-2">ESC</kbd>
            </div>
            <div className="scrollbar-thin max-h-[380px] overflow-y-auto p-2">
              {results.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Zap size={20} className="text-muted-2" />
                  <p className="text-[13px] text-muted">No results for &ldquo;{query}&rdquo;</p>
                </div>
              )}
              {results.map((r, i) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => go(r)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      i === activeIndex ? "bg-tint/[0.07]" : "hover:bg-tint/[0.04]"
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint/5">
                      <Icon size={14} className="text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-foreground">{r.title}</p>
                      <p className="truncate text-[11.5px] text-muted-2">{r.subtitle}</p>
                    </div>
                    {i === activeIndex && <ArrowRight size={13} className="text-muted-2" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-hairline px-4 py-2 text-[10.5px] text-muted-2">
              <span>Search</span>
              <span className="flex items-center gap-2">
                <kbd className="rounded border border-hairline px-1 py-0.5 font-mono">↑↓</kbd> navigate
                <kbd className="rounded border border-hairline px-1 py-0.5 font-mono">↵</kbd> open
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
