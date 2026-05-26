"use server";

import { revalidatePath } from "next/cache";

import { generateDrafts, type GenerationResult } from "@/lib/claude";

export type GenerateActionResult =
  | { ok: true; result: GenerationResult }
  | { ok: false; error: string };

/**
 * Manual "Generate drafts now" trigger from the /debug/draft page. The
 * Vercel Cron job (Stage 9b.4) calls the same `generateDrafts()` function
 * via /api/cron/generate, so manual and scheduled runs are interchangeable.
 */
export async function generateDraftsAction(): Promise<GenerateActionResult> {
  try {
    const result = await generateDrafts();
    revalidatePath("/debug/draft");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}
