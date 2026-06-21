"use client";

// Per-project Reddit auto-generation picker. For each watched repo, choose the
// subreddits the normal Generate run should auto-draft for. Empty = off (opt-in).
// Toggling a pill saves immediately (no separate save button). Reuses the
// sub-pill UI from the moment card.

import { useState, useTransition } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { displayProjectName } from "@/lib/format";
import {
  SUBREDDIT_RULES,
  SUB_SLUGS,
  MAX_SUBS_PER_GENERATE,
  type SubSlug,
} from "@/lib/reddit-subs";
import { saveRedditSubsAction } from "./actions";

type Props = {
  repos: string[];
  /** repo → currently-selected subs. */
  initial: Record<string, SubSlug[]>;
};

export function RedditAutoGenSection({ repos, initial }: Props) {
  if (repos.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Add watched repos above first — Reddit auto-generation is configured
          per repo.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Reddit auto-generation
        </CardTitle>
        <CardDescription>
          Pick the subreddits each project should draft for automatically when
          you click Generate. Up to {MAX_SUBS_PER_GENERATE} per project. Leave
          all unselected to keep Reddit off for that project (no Reddit calls).
          You can still add a one-off sub from any moment&apos;s Reddit tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {repos.map((repo) => (
          <RepoRow key={repo} repo={repo} initial={initial[repo] ?? []} />
        ))}
      </CardContent>
    </Card>
  );
}

function RepoRow({ repo, initial }: { repo: string; initial: SubSlug[] }) {
  const [selected, setSelected] = useState<SubSlug[]>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = (next: SubSlug[]) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await saveRedditSubsAction(repo, next);
      if (!r.ok) {
        setError(r.error);
      } else {
        setSaved(true);
      }
    });
  };

  const toggle = (sub: SubSlug) => {
    const next = selected.includes(sub)
      ? selected.filter((s) => s !== sub)
      : selected.length >= MAX_SUBS_PER_GENERATE
        ? selected // at cap — clicking a new pill is a no-op
        : [...selected, sub];
    if (next === selected) return; // unchanged; don't save
    setSelected(next);
    persist(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-medium">
          {displayProjectName(repo)}
        </span>
        {pending && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
        {!pending && saved && (
          <span className="text-xs text-wyco-teal flex items-center gap-1">
            <Check className="size-3.5" />
            saved
          </span>
        )}
        {!pending && selected.length === 0 && (
          <span className="text-xs text-muted-foreground">off</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {SUB_SLUGS.map((sub) => {
          const isOn = selected.includes(sub);
          const atCap = !isOn && selected.length >= MAX_SUBS_PER_GENERATE;
          return (
            <button
              key={sub}
              type="button"
              onClick={() => toggle(sub)}
              disabled={atCap || pending}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isOn
                  ? "border-wyco-teal bg-wyco-teal/10 text-wyco-teal"
                  : "border-input text-muted-foreground hover:text-foreground",
                atCap && "opacity-40 cursor-not-allowed",
              )}
            >
              {SUBREDDIT_RULES[sub].displayName}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
    </div>
  );
}
