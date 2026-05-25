"use server";

import { revalidatePath } from "next/cache";

import {
  updateDraftContent,
  updateDraftStatus,
  type DraftStatus,
} from "@/lib/draft-mutations";
import { regenerateDraft, type RegenerateResult } from "@/lib/claude-regenerate";
import { generateDrafts, type GenerationResult } from "@/lib/claude";
import { markDraftAsPosted } from "@/lib/posting";
import { setLastRunAt } from "@/lib/settings";

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

// ── Edit / save a draft ──────────────────────────────────────────────────

export async function saveDraftEditAction(
  draftId: number,
  content: string,
): Promise<SimpleActionResult> {
  try {
    updateDraftContent(draftId, content);
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

// ── Change status (approve / reject / revert) ────────────────────────────

export async function setDraftStatusAction(
  draftId: number,
  status: DraftStatus,
): Promise<SimpleActionResult> {
  try {
    updateDraftStatus(draftId, status);
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
    markDraftAsPosted(draftId, trimmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
  revalidatePath("/");
  return { ok: true };
}

// ── Generate the full weekly batch from the dashboard ────────────────────

export async function generateAllDraftsAction(): Promise<GenerateActionResult> {
  try {
    const result = await generateDrafts();
    // Record this as the "last run" so the header updates whether the
    // trigger was cron or a manual click — semantics: time of last
    // successful generation, regardless of source.
    setLastRunAt(new Date().toISOString());
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}
