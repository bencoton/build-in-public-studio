// Header shown above the main content area on every page.
// Async server component — reads the last_run_at and schedule_cron from
// Supabase. The cron-parser computation is local and synchronous.

import { parseExpression } from "cron-parser";

import { getLastRunAt, getScheduleCron } from "@/lib/settings";
import { relativeTime, relativeFuture } from "@/lib/format";

const SCHEDULER_TIMEZONE = "Europe/London";

export async function AppHeader() {
  // Two Supabase reads — parallel, cheap.
  const [lastRunAt, cronString] = await Promise.all([
    getLastRunAt(),
    getScheduleCron(),
  ]);
  const nextRunAt = computeNextRun(cronString);

  // "Missed run" — last run was over 8 days ago AND scheduler is supposed to
  // be weekly. Common cause: nothing has run in over a week (e.g. before
  // Vercel Cron is wired in Stage 9b.4, or if the deployment was paused).
  const lastRunDate = lastRunAt ? new Date(lastRunAt) : null;
  const isMissed =
    lastRunDate !== null &&
    Date.now() - lastRunDate.getTime() > 8 * 24 * 60 * 60 * 1000;

  return (
    <header className="border-b px-8 py-4 flex items-center justify-between">
      <h1 className="text-sm font-heading font-medium tracking-tight text-muted-foreground">
        Dashboard
      </h1>
      <div
        className="text-xs font-mono"
        title={`Scheduler timezone: ${SCHEDULER_TIMEZONE}. The Vercel Cron job ships in Stage 9b.4 — until then, runs are triggered manually from the dashboard.`}
      >
        <span className={isMissed ? "text-amber-500" : "text-muted-foreground"}>
          Last run:{" "}
          <span className="text-foreground">
            {lastRunAt ? relativeTime(lastRunAt) : "never"}
          </span>
          {isMissed && (
            <span
              className="text-amber-500"
              title="Last scheduled run was over 8 days ago. Click Generate on the dashboard to catch up."
            >
              {" "}
              ⚠
            </span>
          )}
        </span>
        <span className="text-muted-foreground">
          {" "}
          &nbsp;·&nbsp; Next run:{" "}
          <span className="text-foreground">
            {nextRunAt ? relativeFuture(nextRunAt) : "—"}
          </span>
        </span>
      </div>
    </header>
  );
}

/** Compute the next firing time from the cron expression, or null on parse error. */
function computeNextRun(cronString: string): Date | null {
  try {
    // cron-parser's tz option handles DST so we get correct UK 9am year-round.
    const interval = parseExpression(cronString, {
      tz: SCHEDULER_TIMEZONE,
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}
