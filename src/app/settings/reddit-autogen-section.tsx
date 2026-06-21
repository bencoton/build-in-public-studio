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
import { MAX_SUBS_PER_GENERATE } from "@/lib/reddit-subs";
import type { SubredditView } from "@/lib/subreddits";
import { saveRedditSubsAction } from "./actions";

type Props = {
  repos: string[];
  /** The subreddit catalog (curated + user-added) to choose from. */
  catalog: SubredditView[];
  /** repo → currently-selected sub slugs. */
  initial: Record<string, string[]>;
};

export function RedditAutoGenSection({ repos, catalog, initial }: Props) {
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
          Manage the list of subreddits below. You can still add a one-off sub
          from any moment&apos;s Reddit tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No subreddits in the catalog yet — add one under &quot;Manage
            subreddits&quot; below.
          </p>
        ) : (
          repos.map((repo) => (
            <RepoRow
              key={repo}
              repo={repo}
              catalog={catalog}
              initial={initial[repo] ?? []}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RepoRow({
  repo,
  catalog,
  initial,
}: {
  repo: string;
  catalog: SubredditView[];
  initial: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = (next: string[]) => {
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

  const toggle = (slug: string) => {
    const next = selected.includes(slug)
      ? selected.filter((s) => s !== slug)
      : selected.length >= MAX_SUBS_PER_GENERATE
        ? selected // at cap — clicking a new pill is a no-op
        : [...selected, slug];
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
        {catalog.map((sub) => {
          const isOn = selected.includes(sub.slug);
          const atCap = !isOn && selected.length >= MAX_SUBS_PER_GENERATE;
          return (
            <button
              key={sub.slug}
              type="button"
              onClick={() => toggle(sub.slug)}
              disabled={atCap || pending}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isOn
                  ? "border-wyco-teal bg-wyco-teal/10 text-wyco-teal"
                  : "border-input text-muted-foreground hover:text-foreground",
                atCap && "opacity-40 cursor-not-allowed",
              )}
            >
              {sub.displayName}
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
