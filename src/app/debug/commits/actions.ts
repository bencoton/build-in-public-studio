"use server";

import { revalidatePath } from "next/cache";

import { syncWatchedRepos, type SyncSummary } from "@/lib/github-sync";

export type SyncActionResult =
  | { ok: true; summary: SyncSummary }
  | { ok: false; error: string };

/**
 * Manual "Sync now" trigger from the /debug/commits page. The weekly Vercel
 * Cron (Stage 9b.4) triggers /api/cron/generate, which calls generateDrafts(),
 * which calls syncWatchedRepos() internally — so the cron path already covers
 * the scheduled refresh. This button stays for force-fetching between runs.
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
