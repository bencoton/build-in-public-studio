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
    typeof input === "string"
      ? // Replace the space SQLite uses with a "T" and pin to UTC so JavaScript
        // doesn't accidentally interpret it as local time.
        new Date(input.replace(" ", "T") + (input.endsWith("Z") ? "" : "Z"))
      : input;

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
