"use client";

// "use client" tells Next.js this component runs in the browser (not on the
// server). We need this because we read the current URL via usePathname to
// highlight the active nav link.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  NotebookPen,
  Settings,
  CalendarRange,
  FileText,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { WycoBadge } from "@/components/wyco-badge";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/batch", label: "Batch", icon: CalendarRange },
  { href: "/summaries", label: "Summaries", icon: FileText },
  { href: "/history", label: "History", icon: History },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-card/30 px-4 py-6">
      {/* Brand block — small WyCo teal mark + product name. */}
      <Link href="/" className="px-2 mb-8 flex items-center gap-2 group">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-wyco-teal/15 text-wyco-teal group-hover:bg-wyco-teal/25 transition-colors">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
            <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
          </svg>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-heading font-semibold tracking-tight">
            Build-in-Public
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            studio
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          // Highlight current page. "/" should only match exactly,
          // other paths match if pathname starts with them.
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 flex flex-col gap-2">
        <WycoBadge />
        <span className="text-[11px] text-muted-foreground font-mono">
          v0.1.0
        </span>
      </div>
    </aside>
  );
}
