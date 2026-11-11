"use client";

import { WifiOff, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

// Shown instead of a blank error screen, e.g. when a button is pressed while offline
export default function ShellError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div className="mx-auto max-w-[520px] pt-10">
      <GlassCard hover={false} className="px-6 py-10 text-center">
        <Icon size={22} className="mx-auto text-accent" />
        <p className="mt-3 text-[16px] font-semibold">{offline ? "You're offline" : "Something went wrong"}</p>
        <p className="mt-1.5 text-[13.5px] text-muted">
          {offline ? "That change couldn't be saved without internet. Reconnect and try again." : "Try again in a moment. If it keeps happening, tell Claude what you pressed."}
        </p>
        <button onClick={() => retry()} className="mt-5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-dim">
          Try again
        </button>
      </GlassCard>
    </div>
  );
}
