"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X } from "lucide-react";
import { ASSISTANT_NAME } from "@/config";
import { AssistantChat } from "./assistant-chat";

/** Floating button in the corner of every page that opens the assistant in a small window */
export function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // pages that already have their own AI chat on screen
  if (pathname.startsWith("/assistant") || /^\/plans\/[^/]+/.test(pathname)) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-3 z-50 flex h-[min(620px,calc(100vh-120px))] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl lg:bottom-24 lg:right-6"
            role="dialog"
            aria-label={ASSISTANT_NAME}
          >
            <AssistantChat compact />
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? `Close ${ASSISTANT_NAME}` : `Open ${ASSISTANT_NAME}`}
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-[0_10px_30px_-8px_rgba(15,17,16,0.55)] transition hover:scale-105 lg:bottom-6 lg:right-6 lg:h-14 lg:w-14"
      >
        {open ? <X size={20} /> : <Bot size={22} />}
      </button>
    </>
  );
}
