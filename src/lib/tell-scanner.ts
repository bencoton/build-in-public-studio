/*
  Deterministic "AI tell" scanner — pure regex / heuristics, no Claude call.

  Counts the stylistic tells from SPEC-humanizer.md Appendix A so a caller can
  record tellsBefore / tellsAfter around a humanize() pass and prove the rewrite
  did something. Reproducible: the same input always yields the same counts.

  App-agnostic: this file imports NOTHING. It can be copy-imported into any app
  that emits AI text. `humanize.ts` reuses it for the before/after metric.
*/

export type TellCategory =
  | "em_dash"
  | "metronomic_rhythm"
  | "wrap_up_conclusion"
  | "listicle_triad"
  | "sycophantic_opener"
  | "missing_contractions"
  | "not_just_x"
  | "inflated_importance"
  | "hollow_profundity"
  | "banned_diction";

export type TellScan = {
  /** Sum of every category count — the headline metric. */
  total: number;
  /** Per-category breakdown (every category present, 0 when clean). */
  byCategory: Record<TellCategory, number>;
};

/**
 * The catalog's built-in overused-diction list (Appendix A, item 10). Exported
 * so humanize() and the scanner share one source of truth; callers merge their
 * own bannedWords on top. Explicit inflections rather than stemming so the
 * word-boundary match stays deterministic.
 */
export const CATALOG_BANNED_WORDS: string[] = [
  "delve",
  "delving",
  "leverage",
  "leverages",
  "leveraging",
  "seamless",
  "seamlessly",
  "tapestry",
  "revolutionize",
  "revolutionizing",
  "revolutionary",
  "unlock",
  "unlocks",
  "unlocking",
  "robust",
  "navigate",
  "navigating",
  "realm",
];

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

/** Escape a user-supplied banned word for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countBannedDiction(text: string, words: string[]): number {
  let n = 0;
  const seen = new Set<string>();
  for (const raw of words) {
    const word = raw.trim().toLowerCase();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    n += countMatches(text, re);
  }
  return n;
}

/**
 * Heuristic for "metronomic rhythm" (uniform sentence length). Returns 1 when
 * the text has enough sentences AND their word-counts are unusually uniform
 * (low coefficient of variation), else 0. Human writing varies sentence length;
 * AI prose tends toward a flat, even cadence.
 */
function metronomicRhythm(text: string): number {
  const sentences = text
    .split(/[.!?]+[\s\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length < 5) return 0; // too few to judge rhythm

  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean < 6) return 0; // very short fragments — not the tell we mean

  const variance =
    lengths.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lengths.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation
  return cv < 0.35 ? 1 : 0;
}

/**
 * Count the AI tells in a piece of text. `opts.bannedWords` is merged on top of
 * CATALOG_BANNED_WORDS for the diction category.
 */
export function scanTells(
  text: string,
  opts?: { bannedWords?: string[] },
): TellScan {
  const bannedWords = [...CATALOG_BANNED_WORDS, ...(opts?.bannedWords ?? [])];

  const byCategory: Record<TellCategory, number> = {
    // 1. Em-dash overuse (also the spaced double-hyphen used as an em-dash).
    em_dash: countMatches(text, /[—―]|(?:\s--\s)/g),

    // 2. Uniform paragraph/sentence length (metronomic rhythm).
    metronomic_rhythm: metronomicRhythm(text),

    // 3. Rigid wrap-up / conclusion paragraph.
    wrap_up_conclusion: countMatches(
      text,
      /\b(?:in conclusion|to sum up|in summary|to wrap up|all in all|at the end of the day|when all is said and done)\b/gi,
    ),

    // 4. Predictable listicle / triad scaffolding.
    listicle_triad: countMatches(
      text,
      /\bthere are (?:a few|several|two|three|four|five|\d+) (?:reasons|ways|things|key|steps|lessons|takeaways|points)\b|\bhere are (?:the |a few |\d+ )?(?:reasons|ways|things|tips|steps|lessons|takeaways)\b/gi,
    ),

    // 5. Sycophantic / canned openers.
    sycophantic_opener: countMatches(
      text,
      /\b(?:great question|great point|happy to help|glad you asked|i'?m excited to share|hey friends|without further ado|let'?s dive (?:in|into)|buckle up)\b|\babsolutely!/gi,
    ),

    // 6. Missing contractions / stiff register (expandable formal forms).
    missing_contractions: countMatches(
      text,
      /\b(?:do not|does not|did not|is not|are not|was not|were not|has not|have not|had not|cannot|can not|could not|would not|should not|will not|it is|that is|there is|you are|they are|we are|i am|you will|we will|they will|i have|you have|we have|let us)\b/gi,
    ),

    // 7. "Not just X, it's Y" / antithetical see-saw.
    not_just_x: countMatches(
      text,
      /\bnot just\b[^.?!\n]*?\b(?:it'?s|but|they'?re|that'?s|but also)\b|\bisn'?t just\b|\bnot only\b[^.?!\n]*?\bbut also\b/gi,
    ),

    // 8. Inflated importance.
    inflated_importance: countMatches(
      text,
      /\b(?:game[-\s]?changer|game[-\s]?changing|fundamentally (?:transform|transforms|change|changes|alter|alters)|paradigm shift|groundbreaking|transformative|next[-\s]level|cutting[-\s]edge|state[-\s]of[-\s]the[-\s]art|sea change)\b/gi,
    ),

    // 9. Hollow profundity / grand closing abstractions.
    hollow_profundity: countMatches(
      text,
      /\b(?:at its core|at the heart of|the bottom line|more than ever|the future of|true power|real magic|the essence of|speaks volumes|a testament to)\b/gi,
    ),

    // 10. Banned / overused diction (catalog + caller's words).
    banned_diction: countBannedDiction(text, bannedWords),
  };

  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
  return { total, byCategory };
}
