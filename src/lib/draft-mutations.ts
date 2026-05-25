import { supabase } from "./supabase";
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
  const { error } = await supabase
    .from("drafts")
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq("id", draftId);
  if (error) throw new Error(`updateDraftContent(${draftId}): ${error.message}`);
}

/** Update a draft's status — used by approve / reject / revert flows. */
export async function updateDraftStatus(
  draftId: number,
  status: DraftStatus,
): Promise<void> {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const { error } = await supabase
    .from("drafts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", draftId);
  if (error) throw new Error(`updateDraftStatus(${draftId}): ${error.message}`);
}

/**
 * Look up a draft alongside its parent moment — needed by the regenerate
 * server action, which uses the moment's summary + source_refs to build the
 * Claude prompt.
 *
 * Two-query implementation rather than a FK-joined select because the typing
 * comes out cleaner — Supabase JS's auto-inferred nested-resource types can
 * be unstable across versions.
 */
export async function getDraftWithMoment(
  draftId: number,
): Promise<{ draft: DraftRow; moment: MomentRow } | null> {
  const { data: draft, error: e1 } = await supabase
    .from("drafts")
    .select(
      "id, moment_id, variant, content, status, rating, posted_url, posted_at, created_at, updated_at",
    )
    .eq("id", draftId)
    .maybeSingle();
  if (e1) throw new Error(`getDraftWithMoment (draft): ${e1.message}`);
  if (!draft) return null;

  const { data: moment, error: e2 } = await supabase
    .from("moments")
    .select(
      "id, summary, source_type, source_ref, generation_id, created_at, repo",
    )
    .eq("id", draft.moment_id)
    .maybeSingle();
  if (e2) throw new Error(`getDraftWithMoment (moment): ${e2.message}`);
  if (!moment) return null;

  return { draft: draft as DraftRow, moment: moment as MomentRow };
}
