import sql from "./db";
import type { DraftRow, MomentRow } from "./moments";

export type DraftStatus = "draft" | "approved" | "posted" | "rejected";

const VALID_STATUSES: readonly DraftStatus[] = [
  "draft",
  "approved",
  "posted",
  "rejected",
];

/** Update a draft's content (after an inline edit). Bumps updated_at. */
export async function updateDraftContent(
  draftId: number,
  content: string,
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Draft content cannot be empty.");
  }
  try {
    await sql`
      UPDATE drafts
      SET content = ${trimmed}, updated_at = now()
      WHERE id = ${draftId}
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`updateDraftContent(${draftId}): ${msg}`);
  }
}

/** Update a draft's scheduled_for date (or clear it by passing null). */
export async function updateDraftScheduledFor(
  draftId: number,
  scheduledFor: Date | null,
): Promise<void> {
  try {
    await sql`
      UPDATE drafts
      SET scheduled_for = ${scheduledFor}, updated_at = now()
      WHERE id = ${draftId}
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`updateDraftScheduledFor(${draftId}): ${msg}`);
  }
}

/** Update a draft's status — used by approve / reject / revert flows. */
export async function updateDraftStatus(
  draftId: number,
  status: DraftStatus,
): Promise<void> {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  try {
    await sql`
      UPDATE drafts
      SET status = ${status}, updated_at = now()
      WHERE id = ${draftId}
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`updateDraftStatus(${draftId}): ${msg}`);
  }
}

/**
 * Look up a draft alongside its parent moment — needed by the regenerate
 * server action, which uses the moment's summary + source_refs to build the
 * Claude prompt.
 *
 * Two-query implementation — keeps each row's typing simple.
 */
export async function getDraftWithMoment(
  draftId: number,
): Promise<{ draft: DraftRow; moment: MomentRow } | null> {
  const draftRows = await sql<DraftRow[]>`
    SELECT id, moment_id, variant, content, status, rating,
           posted_url, posted_at, scheduled_for, created_at, updated_at
    FROM drafts
    WHERE id = ${draftId}
    LIMIT 1
  `;
  const draft = draftRows[0];
  if (!draft) return null;

  const momentRows = await sql<MomentRow[]>`
    SELECT id, summary, source_type, source_ref, generation_id, created_at, repo
    FROM moments
    WHERE id = ${draft.moment_id}
    LIMIT 1
  `;
  const moment = momentRows[0];
  if (!moment) return null;

  return { draft: { ...draft }, moment: { ...moment } };
}
