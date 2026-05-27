"use server";

import { revalidatePath } from "next/cache";

import {
  generateWebsiteSummary,
  generateLaunchAnnouncement,
} from "@/lib/claude-summaries";
import {
  updateSummaryContent,
  markSummaryAsPosted,
} from "@/lib/summaries";

export type SummaryActionResult =
  | { ok: true }
  | { ok: false; error: string };

/** Generate (or regenerate) a project's website summary. Inserts a new row;
 *  the UI shows the latest per kind so the previous version is shadowed. */
export async function generateWebsiteSummaryAction(
  repo: string,
): Promise<SummaryActionResult> {
  if (!repo || !repo.includes("/")) {
    return { ok: false, error: "Pick a project first." };
  }
  try {
    await generateWebsiteSummary(repo);
    revalidatePath("/summaries");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

/** Generate (or regenerate) a project's launch announcement (both variants). */
export async function generateLaunchAnnouncementAction(
  repo: string,
): Promise<SummaryActionResult> {
  if (!repo || !repo.includes("/")) {
    return { ok: false, error: "Pick a project first." };
  }
  try {
    await generateLaunchAnnouncement(repo);
    revalidatePath("/summaries");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

/** Inline-edit save for any summary row. */
export async function saveSummaryEditAction(
  summaryId: number,
  content: string,
): Promise<SummaryActionResult> {
  try {
    await updateSummaryContent(summaryId, content);
    revalidatePath("/summaries");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}

/** Mark a launch summary as posted with the live URL. */
export async function markSummaryPostedAction(
  summaryId: number,
  postedUrl: string,
): Promise<SummaryActionResult> {
  const trimmed = postedUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "URL cannot be empty." };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: "URL should start with http:// or https://." };
  }
  try {
    await markSummaryAsPosted(summaryId, trimmed);
    revalidatePath("/summaries");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
}
