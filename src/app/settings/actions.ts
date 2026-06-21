"use server";

// All server actions for the Settings page. Each one runs on the server when
// called from a client component — Next.js handles the RPC machinery.

import { revalidatePath } from "next/cache";

import {
  validateAnthropicKey,
  validateGithubToken,
  type ValidationResult,
} from "@/lib/key-validators";
import { listUserRepos, type RepoListResult } from "@/lib/github-repos";
import {
  setWatchedRepos,
  setScheduleCron,
  setBannedWords,
  setStyleNotes,
  setRedditSubs,
} from "@/lib/settings";

// ── API-key validation ────────────────────────────────────────────────────

export async function testAnthropicAction(): Promise<ValidationResult> {
  return validateAnthropicKey();
}

export async function testGithubAction(): Promise<ValidationResult> {
  return validateGithubToken();
}

// ── GitHub repo listing ───────────────────────────────────────────────────

export async function loadReposAction(): Promise<RepoListResult> {
  return listUserRepos();
}

// ── Saving settings ───────────────────────────────────────────────────────

export type SaveResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Save the watched-repos selection. `formData` has a `repos` entry per
 * checked checkbox (FormData.getAll handles the repeating key).
 */
export async function saveWatchedReposAction(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  try {
    const repos = formData
      .getAll("repos")
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    await setWatchedRepos(repos);
    revalidatePath("/settings");
    return {
      ok: true,
      message: repos.length === 0
        ? "Watched repos cleared."
        : `${repos.length} repo${repos.length === 1 ? "" : "s"} saved.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

/**
 * Save the per-repo Reddit auto-generation subs. Called programmatically from
 * the settings pills (not a form) with the full desired selection. Validation
 * + the 3-sub cap live in setRedditSubs; empty list = auto-gen off for the repo.
 */
export async function saveRedditSubsAction(
  repo: string,
  subs: string[],
): Promise<SaveResult> {
  try {
    if (!repo.trim()) {
      return { ok: false, error: "Missing repo." };
    }
    await setRedditSubs(repo, subs);
    revalidatePath("/settings");
    return {
      ok: true,
      message:
        subs.length === 0
          ? "Reddit auto-generation off for this repo."
          : `${subs.length} sub${subs.length === 1 ? "" : "s"} saved.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

/**
 * Save schedule cron, banned words, style notes — all in one form so a
 * single "Save preferences" click commits the lot.
 */
export async function savePreferencesAction(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  try {
    const cron = String(formData.get("schedule_cron") ?? "").trim();
    const bannedWordsRaw = String(formData.get("banned_words") ?? "");
    const styleNotes = String(formData.get("style_notes") ?? "");

    if (!cron) {
      return { ok: false, error: "Schedule cron expression cannot be empty." };
    }
    // Light sanity check — full cron validation would need a library; this
    // catches the common mistakes (wrong field count, total garbage).
    const parts = cron.split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      return {
        ok: false,
        error: `Cron expression should be 5 fields (or 6 with seconds). Got ${parts.length}: "${cron}".`,
      };
    }

    await setScheduleCron(cron);
    await setBannedWords(
      bannedWordsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    await setStyleNotes(styleNotes.trim());

    revalidatePath("/settings");
    return { ok: true, message: "Preferences saved." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}
