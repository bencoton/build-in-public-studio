"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateDraftsAction, type GenerateActionResult } from "./actions";

export function GenerateButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GenerateActionResult | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Tick an elapsed-seconds counter while a generation is in flight, so a
  // long wait (60-90s isn't unusual for Sonnet with 4k tokens of output)
  // feels like progress rather than a frozen UI.
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
      const r = await generateDraftsAction();
      setResult(r);
    });
  };

  return (
    <div className="space-y-3">
      <Button type="button" onClick={handleGenerate} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {pending ? `Generating... ${elapsed}s elapsed` : "Generate drafts now"}
      </Button>
      {pending && (
        <p className="text-xs text-muted-foreground font-mono">
          Sonnet typically takes 45–90s for a full 3-5 moment batch. Per-moment
          regenerates (Stage 6) will be much faster.
        </p>
      )}

      {result?.ok === true && (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-wyco-teal">
            <Check className="size-4" />
            Generated {result.result.momentCount} moment
            {result.result.momentCount === 1 ? "" : "s"}.
          </div>
          <div className="text-xs font-mono text-muted-foreground pl-6">
            Tokens — input: {result.result.inputTokens}, output:{" "}
            {result.result.outputTokens}
            {result.result.cacheReadTokens > 0 && (
              <>, cache-read: {result.result.cacheReadTokens}</>
            )}
            {result.result.cacheCreationTokens > 0 && (
              <>, cache-write: {result.result.cacheCreationTokens}</>
            )}
          </div>
        </div>
      )}

      {result?.ok === false && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}
    </div>
  );
}
