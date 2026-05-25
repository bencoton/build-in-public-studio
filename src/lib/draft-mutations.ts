import { db } from "./db";
import type { DraftRow, MomentRow } from "./moments";

export type DraftStatus = "draft" | "approved" | "posted" | "rejected";

const VALID_STATUSES: readonly DraftStatus[] = [
  "draft",
  "approved",
  "posted",
  "rejected",
];

/** Update a draft's content (after an inline edit). Bumps updated_at. */
export function updateDraftContent(draftId: number, content: string): void {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Draft content cannot be empty.");
  }
  db.prepare(
    `UPDATE drafts SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(trimmed, draftId);
}

/** Update a draft's status — used by approve / reject / revert flows. */
export function updateDraftStatus(draftId: number, status: DraftStatus): void {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  db.prepare(
    `UPDATE drafts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(status, draftId);
}

/**
 * Look up a draft alongside its parent moment — needed by the regenerate
 * server action, which needs the moment's summary + source_refs to build the
 * Claude prompt.
 */
export function getDraftWithMoment(
  draftId: number,
): { draft: DraftRow; moment: MomentRow } | null {
  const draft = db
    .prepare(
      `SELECT id, moment_id, variant, content, status, rating, posted_url, posted_at, created_at, updated_at
         FROM drafts WHERE id = ?`,
    )
    .get(draftId) as DraftRow | undefined;
  if (!draft) return null;

  const moment = db
    .prepare(
      `SELECT id, summary, source_type, source_ref, generation_id, created_at
         FROM moments WHERE id = ?`,
    )
    .get(draft.moment_id) as MomentRow | undefined;
  if (!moment) return null;

  return { draft, moment };
}
