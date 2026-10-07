"use client";

import { usePathname } from "next/navigation";
import { Zap, Search } from "lucide-react";
import { APP_NAME } from "@/config";
import { NAV_ITEMS, isActive } from "./nav";

export function Topbar({ onOpenCommand, onOpenCapture }: { onOpenCommand: () => void; onOpenCapture: () => void }) {
  const pathname = usePathname();
  const title = NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? APP_NAME;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-background/70 px-5 py-3 backdrop-blur-xl lg:px-8">
      <div>
        <p className="text-[15px] font-semibold tracking-tight">{title}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommand}
          aria-label="Search"
          className="flex items-center gap-2 rounded-lg border border-hairline bg-tint/[0.03] px-3 py-1.5 text-[12px] text-muted transition hover:text-foreground"
        >
          <Search size={13} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-hairline bg-tint/5 px-1 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
        </button>
        <button
          onClick={onOpenCapture}
          className="flex items-center gap-1.5 rounded-lg bg-accent/90 px-3 py-1.5 text-[12px] font-medium text-white shadow-[0_0_20px_var(--accent-glow)] transition hover:bg-accent"
        >
          <Zap size={13} />
          Capture
        </button>
      </div>
    </header>
  );
}
