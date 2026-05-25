import { db } from "./db";

/**
 * Mark a draft as posted: save the URL, set the timestamp, flip status to
 * "posted". Single statement so it's atomic — no transaction needed.
 */
export function markDraftAsPosted(draftId: number, postedUrl: string): void {
  const trimmed = postedUrl.trim();
  if (!trimmed) {
    throw new Error("Posted URL cannot be empty.");
  }
  if (trimmed.length > 2000) {
    throw new Error("Posted URL is too long.");
  }
  db.prepare(
    `UPDATE drafts
       SET status = 'posted',
           posted_url = ?,
           posted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(trimmed, draftId);
}
