import { supabase } from "./supabase";

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
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("drafts")
    .update({
      status: "posted",
      posted_url: trimmed,
      posted_at: now,
      updated_at: now,
    })
    .eq("id", draftId);
  if (error) throw new Error(`markDraftAsPosted(${draftId}): ${error.message}`);
}
