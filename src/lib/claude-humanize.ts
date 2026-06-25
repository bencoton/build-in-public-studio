import { getAnthropicKey } from "./env-keys";
import { getBannedWords, getStyleNotes } from "./settings";
import { getDraftWithMoment, updateDraftContent } from "./draft-mutations";
import { getStarredExamples } from "./history";
import { humanize, type HumanizeResult, type HumanizeFormat } from "./humanize";

/*
  On-demand "Humanize" for a single existing draft (SPEC-humanizer.md Phase 2).

  Mirrors claude-regenerate.ts: load the draft, gather the same voice signals
  (banned words, style notes, starred examples for THIS variant), run the
  standalone humanize() module over the draft's current content, then persist
  with updateDraftContent — content only, so the draft's status/lifecycle is
  untouched and the existing revert/restore path keeps working.

  Default humanize passes (tells-only + audit). The voice pass is NOT forced —
  the draft was already written in the user's voice; this is a de-slop pass.

  Cost/latency: one draft = at most 2 sequential Claude calls (tells + audit).
  A total wall-clock bound (below) aborts whichever call is in flight so two
  ~15s calls can't drift past the serverless cap.
*/

// Bound across the (tells + audit) calls. humanize() also caps each individual
// Anthropic call at 60s, but two sequential calls could in theory exceed the
// serverless function limit — so abort the whole thing first.
const HUMANIZE_TOTAL_TIMEOUT_MS = 55_000;

export async function humanizeDraft(draftId: number): Promise<HumanizeResult> {
  const key = getAnthropicKey();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it in Settings first.");
  }

  const found = await getDraftWithMoment(draftId);
  if (!found) {
    throw new Error(`Draft ${draftId} not found.`);
  }
  const { draft } = found;

  if (
    draft.variant !== "x_thread" &&
    draft.variant !== "ih_long" &&
    draft.variant !== "reddit"
  ) {
    throw new Error(`Unknown variant: ${draft.variant}`);
  }

  if (!draft.content || draft.content.trim().length === 0) {
    throw new Error(`Draft ${draftId} has no content to humanize.`);
  }

  // Same inputs the regenerate path gathers. Starred examples are scoped to
  // THIS variant so the voice signal matches (reddit voice for reddit, etc.);
  // humanize() takes raw strings, so map HistoryDraft[] → string[].
  const [userBannedWords, styleNotes, starred] = await Promise.all([
    getBannedWords(),
    getStyleNotes(),
    getStarredExamples(10, draft.variant),
  ]);
  const voiceExamples = starred.map((e) => e.content);

  // Map the variant to humanize's light format guardrail. The variant strings
  // already match the format union, but map explicitly so a future variant
  // can't silently leak through as the wrong format.
  const format: HumanizeFormat =
    draft.variant === "x_thread"
      ? "x_thread"
      : draft.variant === "ih_long"
        ? "ih_long"
        : "reddit";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HUMANIZE_TOTAL_TIMEOUT_MS);
  try {
    const result = await humanize(draft.content, {
      apiKey: key,
      voiceExamples,
      bannedWords: userBannedWords,
      styleNotes,
      format,
      // Default passes = tells-only + audit (do NOT force the voice pass).
      signal: controller.signal,
    });

    // Persist exactly like regenerate — content only. Status untouched.
    await updateDraftContent(draftId, result.text);

    return result;
  } finally {
    clearTimeout(timer);
  }
}
