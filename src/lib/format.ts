/**
 * Strip the "owner/" prefix from a "owner/repo" GitHub identifier for display.
 * The DB and URL params keep the full form so we never have ambiguity between
 * two repos with the same name under different owners — but the UI doesn't
 * need to remind the user of their own GitHub username on every label.
 *
 * "bencoton/build-in-public-studio" → "build-in-public-studio"
 * "General"                          → "General" (unchanged)
 */
export function displayProjectName(fullName: string): string {
  const slash = fullName.lastIndexOf("/");
  return slash === -1 ? fullName : fullName.slice(slash + 1);
}

/**
 * "in 3 hours" / "in 2 days" formatter — the symmetric counterpart to
 * relativeTime() below. Used by the dashboard header to show "Next run: in X".
 * Returns the absolute date for anything more than ~5 weeks out.
 */
export function relativeFuture(input: string | Date): string {
  const then = typeof input === "string" ? parseSqliteTimestamp(input) : input;

  const seconds = Math.max(0, Math.round((then.getTime() - Date.now()) / 1000));

  if (seconds < 60) return seconds <= 5 ? "any moment" : `in ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  if (days < 7) return `in ${days} day${days === 1 ? "" : "s"}`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `in ${weeks} week${weeks === 1 ? "" : "s"}`;

  return `on ${then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

/** Shared SQLite-timestamp → Date parser. Pinned to UTC. */
function parseSqliteTimestamp(input: string): Date {
  return new Date(input.replace(" ", "T") + (input.endsWith("Z") ? "" : "Z"));
}

/**
 * Tiny "5 minutes ago" formatter — avoids pulling in date-fns just for this.
 * Stage 9 (the cron scheduler) will need real timezone handling and at that
 * point we add date-fns properly.
 *
 * Input: an ISO-ish string from SQLite's CURRENT_TIMESTAMP, e.g.
 * "2026-05-25 14:32:11". SQLite emits UTC by default without a timezone
 * marker, so we explicitly treat it as UTC.
 */
export function relativeTime(input: string | Date): string {
  const then =
    typeof input === "string" ? parseSqliteTimestamp(input) : input;

  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  // Fall back to a short absolute date for anything older than ~a month.
  return then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
