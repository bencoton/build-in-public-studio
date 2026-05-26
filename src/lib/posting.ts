import sql from "./db";

/**
 * Mark a draft as posted: save the URL, set the timestamp, flip status to
 * "posted". Single UPDATE statement so it's atomic at the row level — no
 * transaction needed.
 */
export async function markDraftAsPosted(
  draftId: number,
  postedUrl: string,
): Promise<void> {
  const trimmed = postedUrl.trim();
  if (!trimmed) {
    throw new Error("Posted URL cannot be empty.");
  }
  if (trimmed.length > 2000) {
    throw new Error("Posted URL is too long.");
  }
  try {
    await sql`
      UPDATE drafts
      SET status = 'posted',
          posted_url = ${trimmed},
          posted_at = now(),
          updated_at = now()
      WHERE id = ${draftId}
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`markDraftAsPosted(${draftId}): ${msg}`);
  }
}
