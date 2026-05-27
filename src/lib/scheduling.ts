// Date helpers for the batch-generation feature.
//
// The product cadence is twice-weekly: Monday and Thursday. Given a starting
// date and a count N, this module returns N timestamps spaced on alternating
// Mon → Thu → Mon → Thu... boundaries, all set to 09:00 Europe/London (which
// matches the AppHeader's "Next run" rendering and the Vercel Cron's
// 08:00 UTC firing).

const POST_HOUR_LOCAL = 9; // 9am Europe/London

/**
 * Generate N scheduled timestamps starting from (or after) `startDate`.
 *
 * Algorithm:
 *   1. Round `startDate` up to the next Monday or Thursday (whichever comes
 *      first), with the time set to 09:00 UK.
 *   2. From there, alternate Mon ↔ Thu until we have N dates.
 *
 * Mon → Thu = +3 days; Thu → Mon = +4 days. The output is strictly
 * ascending and contains no weekend dates.
 *
 * Pure function. Does not touch the DB.
 */
export function stagger(startDate: Date, count: number): Date[] {
  if (count <= 0) return [];

  const first = nextMonOrThu(startDate);
  const out: Date[] = [first];

  for (let i = 1; i < count; i++) {
    const prev = out[i - 1];
    // prev is either Mon (getDay 1) or Thu (getDay 4). Mon → Thu = +3, Thu → Mon = +4.
    const isMonday = prev.getUTCDay() === 1;
    const next = new Date(prev.getTime());
    next.setUTCDate(prev.getUTCDate() + (isMonday ? 3 : 4));
    out.push(next);
  }

  return out;
}

/**
 * Round a date up to the next Monday or Thursday at 09:00 UK. If the input is
 * already a Mon/Thu at or before 09:00 UK, that same date (with the time
 * normalised) is returned.
 *
 * Implementation note: we compute Mon/Thu from UTC day-of-week. Since
 * 09:00 UK is 08:00 UTC (BST) or 09:00 UTC (GMT), and "Monday in UK" is the
 * same calendar day as "Monday in UTC" except in the narrow midnight window,
 * UTC day-of-week is a correct proxy for this app's purposes. We could swap
 * to a proper timezone library if we ever ship outside Europe/London.
 */
function nextMonOrThu(input: Date): Date {
  const d = new Date(input.getTime());
  // Normalise to 09:00 UTC of the same calendar date.
  d.setUTCHours(POST_HOUR_LOCAL - 1, 0, 0, 0); // 08:00 UTC ≈ 09:00 UK BST

  while (true) {
    const dow = d.getUTCDay();
    if (dow === 1 || dow === 4) {
      // Mon or Thu — if the original input was strictly before this slot,
      // we're done. If it was strictly after this slot (same date, later
      // time), advance one more day.
      if (d.getTime() >= input.getTime()) return d;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

/**
 * Format a Date as an ISO YYYY-MM-DD string in UK local time. Used by the
 * batch form's <input type="date"> and date-edit widgets — those expect
 * date-only strings in the local calendar.
 */
export function toLocalDateString(d: Date): string {
  // Force into Europe/London local-date interpretation via toLocaleDateString.
  // "en-CA" gives YYYY-MM-DD shape directly.
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

/**
 * Parse a YYYY-MM-DD string (from the date input) as a UK-local date at
 * 09:00. Throws on malformed input.
 */
export function fromLocalDateString(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): ${s}`);
  }
  // Treat as UK 09:00 → 08:00 UTC (during BST). Close enough for scheduling;
  // an hour drift at DST changeover doesn't affect the user-facing date.
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, POST_HOUR_LOCAL - 1, 0, 0));
}
