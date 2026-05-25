"use server";

import { revalidatePath } from "next/cache";

import {
  updateDraftContent,
  updateDraftStatus,
  type DraftStatus,
} from "@/lib/draft-mutations";
import { regenerateDraft, type RegenerateResult } from "@/lib/claude-regenerate";
import { generateDrafts, type GenerationResult } from "@/lib/claude";

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

// ── Generate the full weekly batch from the dashboard ────────────────────

export async function generateAllDraftsAction(): Promise<GenerateActionResult> {
  try {
    const result = await generateDrafts();
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}
