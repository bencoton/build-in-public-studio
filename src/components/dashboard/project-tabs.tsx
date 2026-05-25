// Project filter tabs above the dashboard moment list. Pure server component —
// the active tab is read from the URL (?project=...) so there's no client
// state, no useState, no transitions. Clicking a tab is a normal navigation.

import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type ProjectTab = {
  /** URL key: "all" | "general" | "owner/name" */
  key: string;
  /** Display label */
  label: string;
  /** Number of moments in this project (or total for "all") */
  count: number;
  /**
   * True when every draft in every moment of this project is out of the
   * 'draft' state — i.e. you've decided what to do with all of them.
   * Drives the lime/check colour cue.
   */
  allActioned: boolean;
};

type Props = {
  tabs: ProjectTab[];
  activeKey: string;
};

export function ProjectTabs({ tabs, activeKey }: Props) {
  if (tabs.length <= 1) {
    // Only the "All" tab — no point showing the bar.
    return null;
  }

  return (
    <div className="flex flex-wrap gap-0 border-b -mx-1">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        // "All actioned" indicator only makes sense if the project has at
        // least one moment — an empty project being marked "done" would be
        // misleading.
        const isDone = tab.allActioned && tab.count > 0;
        const href = tab.key === "all" ? "/" : `/?project=${encodeURIComponent(tab.key)}`;
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "px-3 py-2 mx-1 text-sm font-medium -mb-px border-b-2 inline-flex items-center gap-2 transition-colors",
              isActive
                ? "border-wyco-teal text-foreground"
                : "border-transparent hover:text-foreground",
              !isActive && (isDone ? "text-wyco-lime" : "text-muted-foreground"),
              isActive && isDone && "text-wyco-lime border-wyco-lime",
            )}
            // Server-rendered scroll restoration is fine for this — no behavior tweaks needed.
          >
            <span className={cn(tab.key !== "all" && tab.key !== "general" && "font-mono text-xs")}>
              {tab.label}
            </span>
            <span
              className={cn(
                "text-xs rounded-full px-1.5 py-0.5",
                isActive
                  ? "bg-foreground/10 text-foreground"
                  : "bg-foreground/5 text-muted-foreground",
                isDone && "bg-wyco-lime/15 text-wyco-lime",
              )}
            >
              {tab.count}
            </span>
            {isDone && <Check className="size-3.5" />}
          </Link>
        );
      })}
    </div>
  );
}
