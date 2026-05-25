"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Loader2, Check, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { syncCommitsAction, type SyncActionResult } from "./actions";
import type { SyncSummary } from "@/lib/github-sync";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncActionResult | null>(null);

  const handleSync = () => {
    setResult(null);
    startTransition(async () => {
      const r = await syncCommitsAction();
      setResult(r);
    });
  };

  return (
    <div className="space-y-3">
      <Button type="button" onClick={handleSync} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {pending ? "Syncing..." : "Sync now"}
      </Button>

      {result?.ok === true && <SuccessSummary summary={result.summary} />}
      {result?.ok === false && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {result.error}
        </div>
      )}
    </div>
  );
}

function SuccessSummary({ summary }: { summary: SyncSummary }) {
  const successes = summary.repos.filter((r) => r.ok);
  const failures = summary.repos.filter((r) => !r.ok);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-wyco-teal">
        <Check className="size-4" />
        Sync complete. {summary.totalInserted} new commit
        {summary.totalInserted === 1 ? "" : "s"} (
        {summary.totalFetched} fetched).
      </div>

      {successes.length > 0 && (
        <ul className="text-xs font-mono text-muted-foreground space-y-0.5 pl-6">
          {successes.map((r) => (
            <li key={r.repo}>
              {r.repo}: <span className="text-foreground">{r.ok ? r.inserted : 0}</span> new /
              {r.ok ? r.fetched : 0} fetched
            </li>
          ))}
        </ul>
      )}

      {failures.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            {failures.length} repo{failures.length === 1 ? "" : "s"} failed:
          </div>
          <ul className="text-xs space-y-0.5 pl-6">
            {failures.map((r) => (
              <li key={r.repo} className="text-destructive">
                <span className="font-mono">{r.repo}</span>{" "}
                <Badge variant="destructive" className="ml-1">
                  {r.ok ? "" : r.status ?? "ERR"}
                </Badge>{" "}
                — {r.ok ? "" : r.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
