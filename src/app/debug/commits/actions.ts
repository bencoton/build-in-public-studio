"use server";

import { revalidatePath } from "next/cache";

import { syncWatchedRepos, type SyncSummary } from "@/lib/github-sync";

export type SyncActionResult =
  | { ok: true; summary: SyncSummary }
  | { ok: false; error: string };

/**
 * Manual "Sync now" trigger from the /debug/commits page. The real Monday-9am
 * scheduler ships in Stage 9; this is the way to refresh during development
 * and for users who want to force-fetch between scheduled runs.
 */
export async function syncCommitsAction(): Promise<SyncActionResult> {
  try {
    const summary = await syncWatchedRepos();
    // Refresh the server-rendered commit list below.
    revalidatePath("/debug/commits");
    return { ok: true, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}
