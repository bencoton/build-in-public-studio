// Project filter "tabs" above the dashboard moment list — actually pill
// buttons, not bottom-border tabs. Pure server component: the active tab is
// read from the URL (?project=...) so there's no client state.

import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { displayProjectName } from "@/lib/format";

export type ProjectTab = {
  /** URL key: "all" | "general" | "owner/name" (full form, never stripped) */
  key: string;
  /** Display label (already stripped of any "owner/" prefix by the caller). */
  label: string;
  /** Number of moments in this project (or total for "all") */
  count: number;
  /**
   * True when every draft in every moment of this project is out of the
   * 'draft' state — i.e. you've decided what to do with all of them.
   * Drives the lime "done" colour cue.
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
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const isDone = tab.allActioned && tab.count > 0;
        const href =
          tab.key === "all" ? "/" : `/?project=${encodeURIComponent(tab.key)}`;

        // Pill style mixes three states (active × done × default). Class
        // ordering is intentional — later classes win in case of conflict.
        const pillClass = cn(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-all duration-150",
          // Default (inactive, not done)
          "bg-card border-input text-muted-foreground hover:bg-accent hover:text-foreground",
          // Done but not active — soft lime tint
          !isActive &&
            isDone &&
            "bg-wyco-lime/10 border-wyco-lime/30 text-wyco-lime hover:bg-wyco-lime/15 hover:text-wyco-lime",
          // Active but not done — solid teal
          isActive &&
            !isDone &&
            "bg-primary border-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
          // Active AND done — solid lime, dark slate text for contrast
          isActive &&
            isDone &&
            "bg-wyco-lime border-wyco-lime text-slate-900 hover:bg-wyco-lime hover:text-slate-900",
        );

        const countBadgeClass = cn(
          "inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 text-xs rounded-full leading-none",
          // Default count badge
          "bg-foreground/10 text-current",
          // Active teal: slightly transparent white on teal
          isActive && !isDone && "bg-white/20 text-current",
          // Active lime: dark background on lime for contrast
          isActive && isDone && "bg-slate-900/15 text-slate-900",
          // Inactive done: lime tinted
          !isActive && isDone && "bg-wyco-lime/20 text-current",
        );

        return (
          <Link key={tab.key} href={href} className={pillClass}>
            <span
              className={cn(
                // Project names are mono for that "this is a repo identifier" feel.
                tab.key !== "all" && tab.key !== "general" && "font-mono text-[0.85em]",
              )}
            >
              {tab.label}
            </span>
            <span className={countBadgeClass}>{tab.count}</span>
            {isDone && <Check className="size-3.5" />}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Helper for callers building the tab list — turn an "owner/repo" key into
 * a display label. Re-exported here so callers don't need a separate import.
 */
export function projectLabelFromKey(key: string): string {
  if (key === "all") return "All";
  if (key === "general") return "General";
  return displayProjectName(key);
}
