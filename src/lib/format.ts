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
 * Human label for a draft variant. Reddit drafts show their target sub
 * ("r/SaaS"); X and IH keep their platform names. Used anywhere a draft's
 * platform is shown (history, scheduled list, voice-example formatter) so the
 * three variants render consistently and reddit never gets mislabelled.
 */
export function variantLabel(
  variant: string,
  subreddit?: string | null,
): string {
  if (variant === "x_thread") return "X thread";
  if (variant === "ih_long") return "Indie Hackers";
  if (variant === "reddit") return subreddit ? `r/${subreddit}` : "Reddit";
  return variant;
}

/**
 * "in 3 hours" / "in 2 days" formatter — the symmetric counterpart to
 * relativeTime() below. Used by the dashboard header to show "Next run: in X".
 * Returns the absolute date for anything more than ~5 weeks out.
 */
export function relativeFuture(input: string | Date): string {
  const then = typeof input === "string" ? parseTimestamp(input) : input;

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

/**
 * Robust timestamp parser. Handles both:
 *   - Postgres `timestamptz` strings as returned by postgres.js, e.g.
 *     "2026-05-25T13:42:00+00:00" — already valid ISO 8601, parses directly.
 *   - Legacy SQLite `CURRENT_TIMESTAMP` strings, e.g. "2026-05-25 13:42:00"
 *     — no T separator, no timezone marker, needs both added.
 *
 * The previous implementation unconditionally appended "Z", which corrupted
 * Postgres strings that already had a "+00:00" offset and produced Invalid
 * Date everywhere. We try direct parse first, fall back to the SQLite-shape
 * fix-up if that fails.
 */
export function parseTimestamp(input: string): Date {
  // Postgres ISO 8601 with offset or Z works directly.
  const direct = new Date(input);
  if (!isNaN(direct.getTime())) return direct;

  // Fall back to the SQLite shape ("YYYY-MM-DD HH:MM:SS" → ISO + Z).
  const fixed = input.replace(" ", "T") + (input.endsWith("Z") ? "" : "Z");
  return new Date(fixed);
}

/**
 * Tiny "5 minutes ago" formatter — avoids pulling in date-fns just for this.
 * Postgres returns ISO 8601 with offset on timestamptz columns, which Date()
 * parses correctly without any timezone fiddling. The legacy SQLite shape
 * ("YYYY-MM-DD HH:MM:SS", UTC, no marker) is still handled by parseTimestamp()
 * so old data round-trips.
 */
export function relativeTime(input: string | Date): string {
  const then =
    typeof input === "string" ? parseTimestamp(input) : input;

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
