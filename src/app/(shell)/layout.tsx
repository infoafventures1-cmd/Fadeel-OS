"use client";

import { useEffect, useState } from "react";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { QuickCapture } from "@/components/layout/quick-capture";
import { AssistantBubble } from "@/components/ai/assistant-bubble";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }
      if (!isTyping && !commandOpen && !captureOpen && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setCaptureOpen(true);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, captureOpen]);

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar onOpenCommand={() => setCommandOpen(true)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar onOpenCommand={() => setCommandOpen(true)} onOpenCapture={() => setCaptureOpen(true)} />
        <main className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-24 pt-6 lg:px-8 lg:py-7">{children}</main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
      <AssistantBubble />
      <MobileNav />
    </div>
  );
}
