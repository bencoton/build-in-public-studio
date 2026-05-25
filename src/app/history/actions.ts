"use server";

import { revalidatePath } from "next/cache";

import { setDraftRating, type DraftRating } from "@/lib/history";

export type SetRatingResult = { ok: true } | { ok: false; error: string };

const VALID_RATINGS: DraftRating[] = ["star", "flop", "neutral"];

/**
 * Set or clear a draft's rating.
 * - rating === null clears the rating (used when toggling off an active rating).
 * - Any other value must be 'star', 'flop', or 'neutral'.
 */
export async function setRatingAction(
  draftId: number,
  rating: DraftRating | null,
): Promise<SetRatingResult> {
  if (rating !== null && !VALID_RATINGS.includes(rating)) {
    return { ok: false, error: `Invalid rating: ${rating}` };
  }
  try {
    setDraftRating(draftId, rating);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
  revalidatePath("/history");
  return { ok: true };
}
