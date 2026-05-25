// Header shown above the main content area on every page.
// Server-rendered. Computes "Last run / Next run" from the settings table +
// the user's cron string. Marked async because it reads from the DB.

import { parseExpression } from "cron-parser";

import { getLastRunAt, getScheduleCron } from "@/lib/settings";
import { relativeTime, relativeFuture } from "@/lib/format";

const SCHEDULER_TIMEZONE = "Europe/London";

export function AppHeader() {
  const lastRunAt = getLastRunAt();
  const cronString = getScheduleCron();
  const nextRunAt = computeNextRun(cronString);

  // "Missed run" — last run was over 8 days ago AND scheduler is supposed to
  // be weekly. Common cause: dev server wasn't running last Monday morning.
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
        title={`Scheduler timezone: ${SCHEDULER_TIMEZONE}. Cron only fires while the dev server is running.`}
      >
        <span className={isMissed ? "text-amber-500" : "text-muted-foreground"}>
          Last run:{" "}
          <span className="text-foreground">
            {lastRunAt ? relativeTime(lastRunAt) : "never"}
          </span>
          {isMissed && (
            <span className="text-amber-500" title="Last scheduled run was over 8 days ago — the dev server may have been off. Click Generate on the dashboard to catch up.">
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
