"use server";

import { revalidatePath } from "next/cache";

import { generateDrafts, type GenerationResult } from "@/lib/claude";

export type GenerateActionResult =
  | { ok: true; result: GenerationResult }
  | { ok: false; error: string };

/**
 * Manual "Generate drafts now" trigger from the /debug/draft page. The
 * Monday-9am scheduler in Stage 9 calls the same `generateDrafts()` function.
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
