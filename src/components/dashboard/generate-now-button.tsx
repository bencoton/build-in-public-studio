"use client";

// The "Generate now" button on the dashboard.
//
// Architecture: one server action call per watched repo.
// Each call syncs that repo from GitHub then runs generateDrafts() scoped to
// just that repo. Keeping calls separate means each one comfortably fits inside
// Vercel Hobby's 60s function limit (~15s sync + ~35s generation = ~50s max).
// The client orchestrates them sequentially and shows per-repo progress.

import { useEffect, useState } from "react";
import { Sparkles, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  generateForRepoAction,
  type GenerateActionResult,
} from "@/app/dashboard-actions";

type RepoStatus =
  | { state: "pending" }
  | { state: "running" }
  | { state: "done"; result: GenerateActionResult };

interface Props {
  repos: string[];
}

// Client-side ceiling per repo — a safety net above the server action's own
// timeouts (~10s sync + 90s generate + overhead). Only fires if the server
// transport itself stalls; on fire we mark the repo failed and move on so the
// spinner can never tick forever.
const CLIENT_CEILING_MS = 120_000;

function withClientTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function GenerateNowButton({ repos }: Props) {
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, RepoStatus>>({});
  const [elapsed, setElapsed] = useState(0);

  // Elapsed-seconds counter while any repo is running.
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [running]);

  const handleGenerate = async () => {
    if (repos.length === 0) return;

    // Initialise all repos to "pending".
    const initial: Record<string, RepoStatus> = {};
    for (const r of repos) initial[r] = { state: "pending" };
    setStatuses(initial);
    setRunning(true);

    // Run sequentially — sequential is safer under 60s-per-call Hobby limits.
    // A single repo that errors or times out must NOT block the queue: each
    // call is wrapped so any failure becomes a "done" status and the loop
    // continues to the next repo.
    for (const repo of repos) {
      setStatuses((prev) => ({ ...prev, [repo]: { state: "running" } }));
      let result: GenerateActionResult;
      try {
        result = await withClientTimeout(
          generateForRepoAction(repo),
          CLIENT_CEILING_MS,
          `${repo} timed out — the server didn't respond. Moving on.`,
        );
      } catch (err) {
        result = {
          ok: false,
          error: err instanceof Error ? err.message : "Timed out.",
        };
      }
      setStatuses((prev) => ({ ...prev, [repo]: { state: "done", result } }));
    }

    setRunning(false);
  };

  const doneStatuses = Object.values(statuses).filter(
    (s): s is Extract<RepoStatus, { state: "done" }> => s.state === "done",
  );
  const totalMoments = doneStatuses.reduce(
    (sum, s) => sum + (s.result.ok ? s.result.result.momentCount : 0),
    0,
  );
  const anyError = doneStatuses.some((s) => !s.result.ok);
  const allDone = repos.length > 0 && doneStatuses.length === repos.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleGenerate} disabled={running}>
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {running
            ? `Generating… ${elapsed}s`
            : "Generate this week's drafts"}
        </Button>

        {allDone && !anyError && (
          <span className="text-sm text-wyco-teal flex items-center gap-1.5">
            <Check className="size-4" />
            {totalMoments === 0
              ? "No new moments found — try adding a note or check your repos are syncing."
              : `${totalMoments} moment${totalMoments === 1 ? "" : "s"} drafted.`}
          </span>
        )}
      </div>

      {/* Per-repo progress — only shown while running or after finishing */}
      {Object.keys(statuses).length > 0 && (
        <ul className="space-y-1">
          {repos.map((repo) => {
            const s = statuses[repo];
            if (!s) return null;
            return (
              <li
                key={repo}
                className="text-xs text-muted-foreground flex items-center gap-2 font-mono"
              >
                {s.state === "pending" && (
                  <span className="text-muted-foreground">◦</span>
                )}
                {s.state === "running" && (
                  <Loader2 className="size-3 animate-spin text-wyco-teal" />
                )}
                {s.state === "done" && s.result.ok && (
                  <Check className="size-3 text-wyco-teal" />
                )}
                {s.state === "done" && !s.result.ok && (
                  <span className="size-3 text-muted-foreground leading-none">–</span>
                )}
                <span>{repo}</span>
                {s.state === "done" && s.result.ok && (
                  <span className="text-muted-foreground">
                    — {s.result.result.momentCount} moment
                    {s.result.result.momentCount === 1 ? "" : "s"}
                  </span>
                )}
                {s.state === "done" && !s.result.ok && (
                  <span className="text-muted-foreground">{s.result.error}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {running && (
        <p className="text-xs text-muted-foreground">
          Syncing GitHub then generating per repo. Each repo takes ~30–50s.
        </p>
      )}
    </div>
  );
}
