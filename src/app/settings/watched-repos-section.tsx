"use client";

// Watched-repos picker. Loads the user's repos on demand (only after the
// GitHub key is set), shows them as checkboxes, and saves the selection.

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Github, Loader2, RefreshCw, Lock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  loadReposAction,
  saveWatchedReposAction,
  type SaveResult,
} from "./actions";
import type { GithubRepo } from "@/lib/github-repos";

type Props = {
  githubSet: boolean;
  initialWatched: string[];
};

const initialSaveState: SaveResult | null = null;

export function WatchedReposSection({ githubSet, initialWatched }: Props) {
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadPending, startLoading] = useTransition();
  const [saveState, saveAction] = useFormState(
    saveWatchedReposAction,
    initialSaveState,
  );

  const handleLoad = () => {
    setLoadError(null);
    startLoading(async () => {
      const r = await loadReposAction();
      if (r.ok) {
        setRepos(r.repos);
      } else {
        setRepos(null);
        setLoadError(r.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Github className="size-4 text-muted-foreground" />
          Watched repos
        </CardTitle>
        <CardDescription>
          Pick the repos this app will pull commits from each week.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!githubSet && (
          <p className="text-sm text-muted-foreground">
            Set <code className="font-mono">GITHUB_TOKEN</code> in{" "}
            <code className="font-mono">.env.local</code> and validate it
            above. Once that&apos;s green, the load button here will work.
          </p>
        )}

        {githubSet && repos === null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoad}
            disabled={loadPending}
          >
            {loadPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {loadPending ? "Loading..." : "Load my repos"}
          </Button>
        )}

        {loadError && (
          <p className="text-sm text-destructive">{loadError}</p>
        )}

        {repos !== null && (
          <form action={saveAction} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground font-mono">
                {repos.length} repos loaded — newest pushes first
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLoad}
                disabled={loadPending}
              >
                {loadPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh
              </Button>
            </div>

            <ul className="max-h-80 overflow-y-auto border rounded-md divide-y">
              {repos.map((repo) => (
                <li key={repo.fullName} className="px-3 py-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="repos"
                      value={repo.fullName}
                      defaultChecked={initialWatched.includes(repo.fullName)}
                      className="mt-1 accent-wyco-teal size-4"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="font-mono text-sm flex items-center gap-1.5">
                        {repo.fullName}
                        {repo.private && (
                          <Lock className="size-3 text-muted-foreground" />
                        )}
                      </span>
                      {repo.description && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {repo.description}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3">
              <SaveButton />
              {saveState?.ok === true && (
                <span className="text-sm text-wyco-teal">
                  {saveState.message}
                </span>
              )}
              {saveState?.ok === false && (
                <span className="text-sm text-destructive">
                  {saveState.error}
                </span>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving..." : "Save selection"}
    </Button>
  );
}
