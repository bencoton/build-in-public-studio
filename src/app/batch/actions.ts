"use server";

import { revalidatePath } from "next/cache";

import { generateDrafts, type GenerationResult } from "@/lib/claude";
import { fromLocalDateString } from "@/lib/scheduling";

export type BatchGenerateActionResult =
  | { ok: true; result: GenerationResult }
  | { ok: false; error: string };

/**
 * Batch generation server action. Fed by the batch page's client form.
 *
 * Note: this is a heavyweight Claude call — wider window, up to 15 moments,
 * 16k output cap. Expect 90–180s on a cold start. Pro tier maxDuration of
 * 300s (set on src/app/batch/page.tsx) accommodates it comfortably.
 *
 * `last_run_at` is intentionally NOT bumped here — that field tracks the
 * weekly cron path's recency, used by the AppHeader's "Last run" badge.
 * Mixing batch runs into that signal would muddy the "did Monday fire?"
 * answer.
 */
export async function batchGenerateAction(args: {
  windowDays: number;
  maxMoments: number;
  startDate: string; // YYYY-MM-DD in UK local time
  repoFilter: string | null;
}): Promise<BatchGenerateActionResult> {
  // Validation — keep defensive even though the form caps these client-side.
  // A direct API caller could pass anything.
  if (!Number.isFinite(args.windowDays) || args.windowDays < 7 || args.windowDays > 365) {
    return { ok: false, error: "Window must be between 7 and 365 days." };
  }
  if (!Number.isFinite(args.maxMoments) || args.maxMoments < 1 || args.maxMoments > 15) {
    return { ok: false, error: "Max moments must be between 1 and 15." };
  }

  let startDate: Date;
  try {
    startDate = fromLocalDateString(args.startDate);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid start date.",
    };
  }

  try {
    const result = await generateDrafts({
      windowDays: args.windowDays,
      maxMoments: args.maxMoments,
      repoFilter: args.repoFilter,
      maxOutputTokens: 16384,
      scheduling: { startDate },
    });
    // Surface fresh moments on the dashboard's "Scheduled" section immediately.
    revalidatePath("/");
    revalidatePath("/batch");
    revalidatePath("/history");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}
