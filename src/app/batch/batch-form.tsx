"use client";

// Configuration form for batch generation. Drives batchGenerateAction.
// Defaults are conservative (60-day window, 10 moments, start next Monday,
// all projects) — a "click generate and review" flow without obligating the
// user to learn every knob first.

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Sparkles, Check, AlertCircle, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  batchGenerateAction,
  type BatchGenerateActionResult,
} from "./actions";

type Props = {
  watchedRepos: string[];
  /** Default start date (next Monday, UK local), computed server-side and
   *  passed in so the initial markup matches on both sides — no after-mount
   *  state init, no hydration mismatch. */
  defaultStartDate: string;
};

export function BatchForm({ watchedRepos, defaultStartDate }: Props) {
  const [windowDays, setWindowDays] = useState(60);
  const [maxMoments, setMaxMoments] = useState(10);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [repoFilter, setRepoFilter] = useState<string>("all");
  const [result, setResult] = useState<BatchGenerateActionResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, startTransition] = useTransition();

  // Elapsed-seconds counter while the action runs. The interval's setState is
  // a timer callback (allowed); the counter is reset to 0 in the handler when
  // a run starts, so there's no synchronous setState in the effect.
  useEffect(() => {
    if (!pending) return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [pending]);

  const handleGenerate = () => {
    setResult(null);
    setElapsed(0);
    startTransition(async () => {
      const r = await batchGenerateAction({
        windowDays,
        maxMoments,
        startDate,
        repoFilter: repoFilter === "all" ? null : repoFilter,
      });
      setResult(r);
    });
  };

  const inputClass =
    "w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  // For the projected last-date hint, mirror the stagger algorithm at a high
  // level: assume start on Mon → Mon, Thu, Mon... = avg 3.5 days per slot.
  const projectedLastDate = useMemo(() => {
    if (!startDate || maxMoments <= 1) return null;
    try {
      // Parse the YYYY-MM-DD as a UK 09:00 timestamp.
      const [y, m, d] = startDate.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, 8, 0, 0));
      const daysOut = Math.ceil((maxMoments - 1) * 3.5);
      const end = new Date(start.getTime() + daysOut * 24 * 60 * 60 * 1000);
      return end.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/London",
      });
    } catch {
      return null;
    }
  }, [startDate, maxMoments]);

  return (
    <div className="space-y-6">
      {/* Window */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Look-back window</label>
        <div className="flex gap-2 flex-wrap">
          {[30, 60, 90, 180].map((days) => (
            <Button
              key={days}
              type="button"
              size="sm"
              variant={windowDays === days ? "default" : "outline"}
              onClick={() => setWindowDays(days)}
              disabled={pending}
            >
              {days} days
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          How far back to scan commits + notes. Longer windows find more material
          but cost more tokens.
        </p>
      </div>

      {/* Moment count */}
      <div className="space-y-2">
        <label htmlFor="maxMoments" className="text-sm font-medium">
          How many moments? <span className="font-mono">{maxMoments}</span>
        </label>
        <input
          id="maxMoments"
          type="range"
          min={5}
          max={15}
          step={1}
          value={maxMoments}
          onChange={(e) => setMaxMoments(Number(e.target.value))}
          disabled={pending}
          className="w-full accent-wyco-teal"
        />
        <p className="text-xs text-muted-foreground">
          5 fills ~2.5 weeks of posting; 15 fills ~5 weeks (Mon + Thu cadence).
        </p>
      </div>

      {/* Start date */}
      <div className="space-y-2">
        <label htmlFor="startDate" className="text-sm font-medium">
          Start staggering from
        </label>
        <input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          disabled={pending}
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-muted-foreground">
          First draft posts on the next Mon or Thu on/after this date.
          {projectedLastDate && (
            <>
              {" "}
              Last draft ~<span className="font-mono">{projectedLastDate}</span>.
            </>
          )}
        </p>
      </div>

      {/* Project filter */}
      <div className="space-y-2">
        <label htmlFor="repoFilter" className="text-sm font-medium">
          Project
        </label>
        <select
          id="repoFilter"
          value={repoFilter}
          onChange={(e) => setRepoFilter(e.target.value)}
          disabled={pending}
          className={`${inputClass} font-mono`}
        >
          <option value="all">All watched projects</option>
          {watchedRepos.map((repo) => (
            <option key={repo} value={repo}>
              {repo}
            </option>
          ))}
        </select>
        {watchedRepos.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No watched repos yet —{" "}
            <Link href="/settings" className="text-wyco-teal hover:underline">
              add some in Settings
            </Link>
            .
          </p>
        )}
      </div>

      {/* Generate button + status */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={pending || !startDate}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {pending
            ? `Generating... ${elapsed}s elapsed`
            : `Generate ${maxMoments} moments`}
        </Button>

        {result?.ok === true && (
          <span className="text-sm text-wyco-teal flex items-center gap-1.5">
            <Check className="size-4" />
            {result.result.momentCount === 0
              ? "No moments — try a longer window or a different project."
              : `${result.result.momentCount} moment${result.result.momentCount === 1 ? "" : "s"} drafted and scheduled.`}
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
          Sonnet takes 90–180s for a 10–15 moment batch on a cold start. Hold
          tight — don&apos;t refresh the page.
        </p>
      )}

      {result?.ok === true && result.result.momentCount > 0 && (
        <div className="pt-2">
          <Button asChild variant="outline">
            <Link href="/">
              <Calendar className="size-4" />
              View scheduled drafts
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
