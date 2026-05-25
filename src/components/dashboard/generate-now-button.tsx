"use client";

// The "Generate now" button on the dashboard. Same underlying server action
// as the /debug/draft page, but the surrounding copy is more user-friendly
// (this is the main UI, not a debug view).

import { useEffect, useState, useTransition } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  generateAllDraftsAction,
  type GenerateActionResult,
} from "@/app/dashboard-actions";

export function GenerateNowButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GenerateActionResult | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [pending]);

  const handleGenerate = () => {
    setResult(null);
    startTransition(async () => {
      const r = await generateAllDraftsAction();
      setResult(r);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleGenerate} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {pending
            ? `Generating drafts... ${elapsed}s elapsed`
            : "Generate this week's drafts"}
        </Button>

        {result?.ok === true && (
          <span className="text-sm text-wyco-teal flex items-center gap-1.5">
            <Check className="size-4" />
            {result.result.momentCount === 0
              ? "No moments — the week's content is thin. Add a note or sync GitHub."
              : `${result.result.momentCount} moment${result.result.momentCount === 1 ? "" : "s"} drafted.`}
          </span>
        )}

        {result?.ok === false && (
          <span className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="size-4" />
            {result.error}
          </span>
        )}
      </div>

      {pending && (
        <p className="text-xs text-muted-foreground font-mono">
          Sonnet typically takes 45–90s for a full 3-5 moment batch. Per-moment
          regenerates below are much faster (~5-10s).
        </p>
      )}
    </div>
  );
}
