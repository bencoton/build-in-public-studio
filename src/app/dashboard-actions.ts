"use server";

import { revalidatePath } from "next/cache";

import {
  updateDraftContent,
  updateDraftScheduledFor,
  updateDraftStatus,
  type DraftStatus,
} from "@/lib/draft-mutations";
import { fromLocalDateString } from "@/lib/scheduling";
import { regenerateDraft, type RegenerateResult } from "@/lib/claude-regenerate";
import {
  generateDrafts,
  generateRedditDrafts,
  generateRedditForRepo,
  type GenerationResult,
  type RedditGenerationResult,
} from "@/lib/claude";
import { syncWatchedRepos, syncOneRepo } from "@/lib/github-sync";
import { markDraftAsPosted } from "@/lib/posting";
import { setLastRunAt } from "@/lib/settings";
import { withTimeout } from "@/lib/timeout";

// ── Generic result types ─────────────────────────────────────────────────

export type SimpleActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type RegenerateActionResult =
  | { ok: true; result: RegenerateResult }
  | { ok: false; error: string };

export type GenerateActionResult =
  | { ok: true; result: GenerationResult }
  | { ok: false; error: string };

export type RedditGenerateActionResult =
  | { ok: true; result: RedditGenerationResult }
  | { ok: false; error: string };

// ── Edit / save a draft ──────────────────────────────────────────────────

export async function saveDraftEditAction(
  draftId: number,
  content: string,
): Promise<SimpleActionResult> {
  try {
    await updateDraftContent(draftId, content);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
  revalidatePath("/");
  return { ok: true };
}

// ── Regenerate a single variant ──────────────────────────────────────────

export async function regenerateDraftAction(
  draftId: number,
): Promise<RegenerateActionResult> {
  try {
    const result = await regenerateDraft(draftId);
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

// ── Update scheduled_for ─────────────────────────────────────────────────

/**
 * Set or clear a draft's scheduled_for date. Accepts a YYYY-MM-DD string in
 * UK local time (matching the date input's value), or null/empty to clear.
 */
export async function updateDraftScheduledForAction(
  draftId: number,
  scheduledFor: string | null,
): Promise<SimpleActionResult> {
  try {
    if (!scheduledFor || scheduledFor.trim() === "") {
      await updateDraftScheduledFor(draftId, null);
    } else {
      const parsed = fromLocalDateString(scheduledFor.trim());
      await updateDraftScheduledFor(draftId, parsed);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
  revalidatePath("/");
  revalidatePath("/history");
  return { ok: true };
}

// ── Change status (approve / reject / revert) ────────────────────────────

export async function setDraftStatusAction(
  draftId: number,
  status: DraftStatus,
): Promise<SimpleActionResult> {
  try {
    await updateDraftStatus(draftId, status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
  revalidatePath("/");
  return { ok: true };
}

// ── Mark a draft as posted (from the Copy + Open flow) ───────────────────

export async function markPostedAction(
  draftId: number,
  postedUrl: string,
): Promise<SimpleActionResult> {
  // Light validation. We don't enforce a URL regex — the user might paste a
  // shortlink or a slug, and being too strict here just frustrates them.
  // We do check it starts with http(s):// so a typo doesn't silently save
  // garbage.
  const trimmed = postedUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "URL cannot be empty." };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: "URL should start with http:// or https://." };
  }
  try {
    await markDraftAsPosted(draftId, trimmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
  revalidatePath("/");
  return { ok: true };
}

// withTimeout lives in @/lib/timeout (shared with the Reddit auto-gen pass).

// Ceilings for the per-repo path. Sync is non-fatal (we fall back to cached
// commits); generation rejects with a clear, repo-named error so a stall
// surfaces instead of hanging forever.
const SYNC_TIMEOUT_MS = 10_000;
const GENERATE_TIMEOUT_MS = 90_000;

// ── Generate + sync for one repo (per-repo orchestration) ────────────────
//
// The client calls this once per watched repo. Each call:
//   1. Syncs that repo's commits from GitHub into the DB
//   2. Runs generateDrafts() filtered to that repo (+ unlinked notes)
//   3. Updates last_run_at and revalidates the dashboard
//
// Keeping it per-repo means each server action call easily fits inside the
// Vercel Hobby 60s function limit (~5-15s sync + ~35-45s generation).
//
// Both stages are time-boxed (mirroring generateAllDraftsAction's sync race)
// so a stalled GitHub call or Anthropic connection can't hang this action
// indefinitely — it either finishes or returns a clear timeout error, and the
// client loop moves on to the next repo.

export async function generateForRepoAction(repo: string): Promise<GenerateActionResult> {
  try {
    // Sync this repo's commits first — non-fatal if it fails OR times out;
    // we proceed with whatever commits are already cached in the DB.
    const tSync = Date.now();
    try {
      const syncResult = await withTimeout(
        syncOneRepo(repo),
        SYNC_TIMEOUT_MS,
        `sync timed out for ${repo}`,
      );
      if (!syncResult.ok) {
        console.warn(`[generateForRepoAction] Sync failed for ${repo}:`, syncResult.error);
      }
    } catch (syncErr) {
      console.warn(`[generateForRepoAction] Sync failed/timed out for ${repo}:`, syncErr);
    } finally {
      console.log(`[generate ${repo}] sync ${Date.now() - tSync}ms`);
    }

    // Generation IS fatal to this repo — but bounded, so a stall rejects with
    // a clear message rather than hanging. The client marks this repo failed
    // and continues to the next.
    const result = await withTimeout(
      generateDrafts({ repoFilter: repo }),
      GENERATE_TIMEOUT_MS,
      `generation timed out for ${repo}`,
    );
    await setLastRunAt(new Date().toISOString());
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

// ── Auto-generate Reddit drafts for a repo's run (dashboard, per-repo) ────
//
// Fired by the Generate button right after generateForRepoAction(repo) returns
// its generationId. Uses the repo's saved subs (Settings); a no-op with zero
// Claude calls if the repo has none selected. Its own bounded invocation, so a
// failure/timeout here is surfaced per-repo and never blocks the queue.

export async function generateRedditForRepoAction(
  repo: string,
  generationId: string,
): Promise<RedditGenerateActionResult> {
  try {
    const result = await generateRedditForRepo(repo, generationId);
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

// ── Generate Reddit drafts for one moment (on demand) ────────────────────
//
// Called from the moment card's Reddit section with the selected subs (capped
// at MAX_SUBS_PER_GENERATE in the generator). One tailored journey-format
// draft per sub is generated and inserted as a variant='reddit' drafts row.

export async function generateRedditDraftsAction(
  momentId: number,
  subs: string[],
): Promise<RedditGenerateActionResult> {
  try {
    const result = await generateRedditDrafts({ momentId, subs });
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

// ── Generate the full weekly batch from the dashboard ────────────────────

export async function generateAllDraftsAction(): Promise<GenerateActionResult> {
  try {
    // Sync GitHub first — capped at 10s so sync + generation stays under the
    // 60s Vercel Hobby function limit. Non-fatal: if it times out or errors
    // we proceed with whatever commits are already in the DB.
    try {
      await Promise.race([
        syncWatchedRepos(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("sync timeout")), 10_000),
        ),
      ]);
    } catch (syncErr) {
      console.warn("[generateAllDraftsAction] GitHub sync failed/timed out:", syncErr);
    }
    const result = await generateDrafts();
    // Record this as the "last run" so the header updates whether the
    // trigger was cron or a manual click — semantics: time of last
    // successful generation, regardless of source.
    await setLastRunAt(new Date().toISOString());
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}
