"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Mark, AppName } from "@/components/brand/mark";
import { OWNER } from "@/config";
import { cn } from "@/lib/utils";
import { NAV, MOBILE_NAV, isActive } from "./nav";

export function Sidebar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="scrollbar-thin sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-hairline bg-surface/60 px-3 py-4 backdrop-blur-xl lg:flex">
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <Mark size={20} className="text-foreground" />
        <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight">
          <AppName accent="span" />
        </span>
      </div>

      <button
        onClick={onOpenCommand}
        className="mb-5 flex items-center justify-between rounded-lg border border-hairline bg-tint/[0.03] px-2.5 py-1.5 text-[12.5px] text-muted transition hover:border-hairline-strong hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Command size={13} />
          Quick search
        </span>
        <kbd className="rounded border border-hairline bg-tint/5 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      <nav className="flex-1 space-y-5">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-2">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
                      active
                        ? "bg-tint/[0.06] text-foreground"
                        : "text-muted hover:bg-tint/[0.03] hover:text-foreground"
                    )}
                  >
                    <Icon size={15} className={cn(active ? "text-accent" : "text-muted-2 group-hover:text-muted")} />
                    <span className="truncate">{item.label}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-hairline bg-tint/[0.02] px-2.5 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint/10 text-[12px] font-semibold text-foreground">
          {OWNER.fullName.trim()[0]?.toUpperCase()}
        </span>
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{OWNER.fullName}</p>
      </div>
      <form action={logout} className="mt-2">
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-muted-2 transition hover:bg-tint/[0.03] hover:text-foreground">
          <LogOut size={13} /> Sign out
        </button>
      </form>
    </aside>
  );
}

/** Phones and tablets have no sidebar, so the same pages sit in a tab bar along the bottom */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px]", active ? "text-foreground" : "text-muted-2")}
          >
            <Icon size={18} className={active ? "text-accent" : undefined} />
            <span className="max-w-full truncate px-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
