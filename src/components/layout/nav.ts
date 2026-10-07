import { LayoutDashboard, Sun, CheckSquare, Calendar, FileText, Settings, Bot, GraduationCap } from "lucide-react";
import { ASSISTANT_NAME } from "@/config";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// The one list of pages: the sidebar, the phone tab bar, the top-bar title and ⌘K all read it.
// To add a page, create src/app/(shell)/<name>/page.tsx and add a line here.
export const NAV: NavGroup[] = [
  {
    label: "Command",
    items: [
      { label: "Home", href: "/home", icon: LayoutDashboard },
      { label: "Today", href: "/today", icon: Sun },
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: ASSISTANT_NAME, href: "/assistant", icon: Bot },
      { label: "Documents", href: "/docs", icon: FileText },
    ],
  },
  {
    label: "Business & Projects",
    items: [{ label: "University Plans", href: "/plans", icon: GraduationCap }],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);

/** The phone tab bar has room for five */
export const MOBILE_NAV = ["/home", "/tasks", "/assistant", "/docs", "/plans"].map((h) => NAV_ITEMS.find((i) => i.href === h)!);

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
