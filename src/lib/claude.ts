import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";

import { getAnthropicKey } from "./env-keys";
import { getBannedWords, getStyleNotes, getRedditSubs } from "./settings";
import { getRecentNotes, getNoteById, type NoteRow } from "./notes";
import {
  getRecentCommits,
  getReposForShaPrefix,
  type CommitRow,
} from "./commits";
import {
  insertMomentWithDrafts,
  insertRedditDraft,
  deleteRedditDraftsForSub,
  getMomentById,
  getMomentsByGeneration,
  type MomentWithDrafts,
} from "./moments";
import { withTimeout } from "./timeout";
import { getStarredExamples, type HistoryDraft } from "./history";
import { stagger } from "./scheduling";
import { variantLabel } from "./format";
import {
  MAX_SUBS_PER_GENERATE,
  isValidSlug,
  normalizeSlug,
  submitUrlFor,
} from "./reddit-subs";
import {
  getSubreddits,
  toView,
  type SubredditView,
} from "./subreddits";
import { DRAFT_SYSTEM_PROMPT } from "@/prompts/draft-system";

/*
  Two-phase moment generation, designed to fit inside Vercel Hobby's 60s
  function-execution cap.

  Phase 1 — identifyMoments(): one Claude call returning just moment summaries
    + source refs. Fast (~10-15s). Writes the system-prompt cache as a side
    effect, so Phase 2 calls hit a primed cache.

  Phase 2 — draftMoment(): N parallel Claude calls, one per identified moment,
    each returning the X thread + IH long-form for THAT moment only. Each
    call sees only the source material relevant to its moment, not the full
    week's content. Wall-clock time scales with the slowest one (~10-15s),
    not N × 15s.

  Total wall-clock budget under Hobby:
    ~15s (identify) + ~15s (parallel draft) + ~3s (DB writes) = ~35s.

  Design notes:
  - All calls use tool_use with strict input_schema. Output shape guaranteed.
  - DRAFT_SYSTEM_PROMPT cached on every call via cache_control: ephemeral.
    Phase 2 calls in parallel race to write the cache, but the cost increase
    is tiny (5 × cache_creation vs 1 × cache_creation + 4 × cache_read in
    the idealised case) and the wall-clock parallelism is what unlocks Hobby.
  - SDK maxRetries: 0 — we handle retries at the app layer if needed.
  - Model: claude-sonnet-4-6 (kept for quality on both phases).
*/

const MODEL = "claude-sonnet-4-6";

// Per-call ceiling on every Anthropic request. Without this the SDK waits up
// to its 600s default, so a stalled connection can hang a whole generation.
// 60s is comfortably above a healthy call (~10-15s) but fails fast on a stall.
const ANTHROPIC_TIMEOUT_MS = 60_000;

const IDENTIFY_TOOL_NAME = "submit_moments";
const DRAFT_MOMENT_TOOL_NAME = "submit_moment_drafts";
const REDDIT_DRAFT_TOOL_NAME = "submit_reddit_draft";

// ── Tool schemas ─────────────────────────────────────────────────────────

function buildIdentifyTool(maxMoments: number) {
  return {
    name: IDENTIFY_TOOL_NAME,
    description:
      "Submit the moments you've identified — just summaries and source refs, no drafted posts yet. Always call this exactly once.",
    input_schema: {
      type: "object" as const,
      properties: {
        moments: {
          type: "array",
          minItems: 0,
          maxItems: maxMoments,
          items: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description:
                  "One short line summarising the moment in concrete terms. Shown above the drafts in the UI.",
              },
              source_type: {
                type: "string",
                enum: ["commit", "note", "mixed"],
                description: "Where this moment came from.",
              },
              source_refs: {
                type: "array",
                items: { type: "string" },
                description:
                  "Identifiers for the commits or notes that informed this moment — short SHAs (7 chars) for commits, numeric note IDs for notes.",
              },
            },
            required: ["summary", "source_type", "source_refs"],
          },
        },
      },
      required: ["moments"],
    },
  };
}

function buildDraftMomentTool() {
  return {
    name: DRAFT_MOMENT_TOOL_NAME,
    description:
      "Submit the two drafted post variants for this single moment. Always call this exactly once.",
    input_schema: {
      type: "object" as const,
      properties: {
        x_thread: {
          type: "string",
          description:
            "X / Twitter thread as a single string. Numbered tweets (1/, 2/, 3/...) separated by blank lines. Each tweet under 280 characters.",
        },
        ih_long: {
          type: "string",
          description:
            "Indie Hackers long-form post, 300-600 words, conversational, one clear takeaway.",
        },
      },
      required: ["x_thread", "ih_long"],
    },
  };
}

function buildRedditDraftTool() {
  return {
    name: REDDIT_DRAFT_TOOL_NAME,
    description:
      "Submit the Reddit post (title + self-text body) tailored to one specific subreddit. Always call this exactly once.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description:
            "The Reddit post title — an honest, specific headline. No clickbait, no hype words, no leading emoji. Reads like a real person describing what happened.",
        },
        body: {
          type: "string",
          description:
            "The self-text body in journey format: real numbers (or a [VERIFY] placeholder), what went wrong, one specific insight, and no forced call-to-action. Plain prose, conversational, tailored to this sub's tone.",
        },
      },
      required: ["title", "body"],
    },
  };
}

// ── Types ─────────────────────────────────────────────────────────────────

export type IdentifiedMoment = {
  summary: string;
  source_type: string;
  source_refs: string[];
};

export type GeneratedMoment = IdentifiedMoment & {
  x_thread: string;
  ih_long: string;
};

export type GenerationResult = {
  generationId: string;
  momentCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

export type GenerateDraftsOptions = {
  /** How many days back to pull commits + notes from. Default 7 (weekly). */
  windowDays?: number;
  /** Cap on moments Claude can return. Default 5 (weekly). Batch flow uses 15. */
  maxMoments?: number;
  /** Restrict to a single watched repo. Default null = all repos. */
  repoFilter?: string | null;
  /** When set, drafts are auto-stagger-scheduled Mon/Thu starting on this date. */
  scheduling?: {
    startDate: Date;
  };
};

type SharedContext = {
  client: Anthropic;
  userBannedWords: string[];
  styleNotes: string;
  voiceExamples: HistoryDraft[];
  commits: CommitRow[];
  notes: NoteRow[];
};

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  // SDK returns `number | null` (not undefined) on these. The `?? 0`
  // coalesce in aggregateUsage handles both null and undefined.
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

// ── Public entry point ───────────────────────────────────────────────────

/**
 * Pull commits + notes within a window, run two-phase generation (identify
 * + parallel draft), persist, return a summary. Services the weekly Vercel
 * Cron path (no options) and the batch-generation path (windowDays /
 * maxMoments / scheduling).
 */
export async function generateDrafts(
  options: GenerateDraftsOptions = {},
): Promise<GenerationResult> {
  const windowDays = options.windowDays ?? 7;
  const maxMoments = options.maxMoments ?? 5;
  const repoFilter = options.repoFilter ?? null;

  const key = getAnthropicKey();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it in Settings first.");
  }

  // ── Load inputs in parallel ───────────────────────────────────────────
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const commitCap = Math.max(500, windowDays * 30);
  const noteCap = Math.max(200, windowDays * 5);

  const [allCommits, allNotes, userBannedWords, styleNotes, voiceExamples] =
    await Promise.all([
      getRecentCommits(commitCap),
      getRecentNotes(noteCap),
      getBannedWords(),
      getStyleNotes(),
      getStarredExamples(10),
    ]);

  let commits = allCommits.filter((c) => c.committed_at >= cutoff);
  let notes = allNotes.filter((n) => n.created_at >= cutoff);

  if (repoFilter) {
    commits = commits.filter((c) => c.repo === repoFilter);
    // Include notes linked to this repo OR unlinked notes (repo=null) — unlinked
    // notes are general observations that should appear in every repo's generation.
    notes = notes.filter((n) => n.repo === repoFilter || n.repo === null);
  }

  if (commits.length === 0 && notes.length === 0) {
    throw new Error(
      `No commits or notes in the last ${windowDays} day${windowDays === 1 ? "" : "s"}` +
        (repoFilter ? ` for ${repoFilter}` : "") +
        ". Sync GitHub or add a note first.",
    );
  }

  const client = new Anthropic({
    apiKey: key,
    maxRetries: 0, // app-layer handles retries if/when needed
    timeout: ANTHROPIC_TIMEOUT_MS, // fail fast on a stalled call
  });

  const context: SharedContext = {
    client,
    userBannedWords,
    styleNotes,
    voiceExamples,
    commits,
    notes,
  };

  // Stage timing keyed by repo, so a future hang shows WHERE it stalled
  // (identify vs draft) in the server logs.
  const repoLabel = repoFilter ?? "all";

  // ── Phase 1: identify moments ─────────────────────────────────────────
  const t0Identify = Date.now();
  const identifyResult = await identifyMoments(context, {
    windowDays,
    maxMoments,
    repoFilter,
  });
  console.log(
    `[generate ${repoLabel}] identifyMoments ${Date.now() - t0Identify}ms → ${identifyResult.moments.length} moment(s)`,
  );

  const generationId = randomUUID();

  if (identifyResult.moments.length === 0) {
    // Nothing post-worthy — return early with zero moments. Surface the
    // identify-phase token usage so the caller can still report cost.
    return {
      generationId,
      momentCount: 0,
      inputTokens: identifyResult.usage.input_tokens,
      outputTokens: identifyResult.usage.output_tokens,
      cacheReadTokens: identifyResult.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: identifyResult.usage.cache_creation_input_tokens ?? 0,
    };
  }

  // ── Phase 2: parallel draft generation ────────────────────────────────
  // All N draft calls fire in parallel. Each gets its own ~15s budget at
  // Anthropic; the wall-clock is the slowest one, not N × 15s.
  //
  // History note (2026-05-29): tried a "serialize first call to prime the
  // cache, then parallel the rest" variant to cut cost. It worked for the
  // cache (cacheRead populated) but pushed wall-clock past 60s on cold
  // starts (504 from Vercel). Reverted — pure parallel is the known-good
  // shape for Hobby compatibility. Cost penalty is ~$0.05/fire (~$5/year
  // at twice-weekly cadence), accepted as the price of fitting in 60s.
  const t0Draft = Date.now();
  const draftResults = await Promise.all(
    identifyResult.moments.map((moment) => draftMoment(moment, context)),
  );
  console.log(
    `[generate ${repoLabel}] draftMoment ×${identifyResult.moments.length} ${Date.now() - t0Draft}ms`,
  );

  // ── Persist ────────────────────────────────────────────────────────────
  const scheduledDates =
    options.scheduling
      ? stagger(options.scheduling.startDate, identifyResult.moments.length)
      : null;

  for (let i = 0; i < identifyResult.moments.length; i++) {
    const moment = identifyResult.moments[i];
    const drafts = draftResults[i].drafts;
    const repo = await deriveMomentRepo(moment.source_type, moment.source_refs);
    await insertMomentWithDrafts({
      summary: moment.summary,
      sourceType: moment.source_type,
      sourceRefs: moment.source_refs,
      generationId,
      xThread: drafts.x_thread,
      ihLong: drafts.ih_long,
      repo,
      scheduledFor: scheduledDates ? scheduledDates[i] : null,
    });
  }

  // ── Aggregate token usage across all calls ────────────────────────────
  const totals = aggregateUsage([
    identifyResult.usage,
    ...draftResults.map((r) => r.usage),
  ]);

  return {
    generationId,
    momentCount: identifyResult.moments.length,
    ...totals,
  };
}

// ── Phase 1: identifyMoments ─────────────────────────────────────────────

async function identifyMoments(
  context: SharedContext,
  options: {
    windowDays: number;
    maxMoments: number;
    repoFilter: string | null;
  },
): Promise<{ moments: IdentifiedMoment[]; usage: AnthropicUsage }> {
  const userMessage = buildIdentifyMessage({
    commits: context.commits,
    notes: context.notes,
    userBannedWords: context.userBannedWords,
    styleNotes: context.styleNotes,
    voiceExamples: context.voiceExamples,
    windowDays: options.windowDays,
    maxMoments: options.maxMoments,
    repoFilter: options.repoFilter,
  });

  const tool = buildIdentifyTool(options.maxMoments);

  const response = await context.client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: DRAFT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: IDENTIFY_TOOL_NAME },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude didn't call ${IDENTIFY_TOOL_NAME}. Stop reason: ${response.stop_reason}.`,
    );
  }
  if (toolUse.name !== IDENTIFY_TOOL_NAME) {
    throw new Error(`Claude called unexpected tool: ${toolUse.name}.`);
  }

  return {
    moments: parseIdentifiedMoments(toolUse.input),
    usage: response.usage,
  };
}

// ── Phase 2: draftMoment (one call per moment) ───────────────────────────

async function draftMoment(
  moment: IdentifiedMoment,
  context: SharedContext,
): Promise<{
  drafts: { x_thread: string; ih_long: string };
  usage: AnthropicUsage;
}> {
  // Filter the shared context to just the source material this moment refers
  // to. Keeps the user message small and focused — Claude only needs to see
  // the commits / notes it's actually writing about.
  const relevantCommits = context.commits.filter((c) =>
    moment.source_refs.some(
      (ref) => c.sha === ref || c.sha.startsWith(ref),
    ),
  );
  const relevantNotes = context.notes.filter((n) =>
    moment.source_refs.includes(String(n.id)),
  );

  const userMessage = buildDraftMomentMessage({
    moment,
    relevantCommits,
    relevantNotes,
    userBannedWords: context.userBannedWords,
    styleNotes: context.styleNotes,
    voiceExamples: context.voiceExamples,
  });

  const tool = buildDraftMomentTool();

  const response = await context.client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: DRAFT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: DRAFT_MOMENT_TOOL_NAME },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude didn't call ${DRAFT_MOMENT_TOOL_NAME} for moment "${moment.summary}". Stop reason: ${response.stop_reason}.`,
    );
  }

  const input = toolUse.input as { x_thread?: unknown; ih_long?: unknown };
  if (typeof input.x_thread !== "string" || typeof input.ih_long !== "string") {
    throw new Error(
      `Claude returned malformed drafts for moment "${moment.summary}".`,
    );
  }

  return {
    drafts: { x_thread: input.x_thread, ih_long: input.ih_long },
    usage: response.usage,
  };
}

// ── Reddit: one draft per (moment × sub) ─────────────────────────────────

export type RedditMomentInput = {
  summary: string;
  source_type: string;
  source_refs: string[];
};

export type RedditDraftContext = {
  client: Anthropic;
  userBannedWords: string[];
  styleNotes: string;
  /** Voice examples — already filtered to reddit-variant by the caller so the
   *  model learns the user's Reddit voice specifically (A1.1). */
  voiceExamples: HistoryDraft[];
};

/**
 * Draft a single Reddit post (title + body) for one subreddit, tailored to
 * that sub's tone and self-promo norms. One Claude call per (moment × sub) —
 * the system prompt is the cached DRAFT_SYSTEM_PROMPT, only the per-sub user
 * message varies, so subs after the first hit a warm cache.
 *
 * Returns the raw title/body + token usage; persistence is the caller's job
 * (insertRedditDraft), mirroring how draftMoment hands drafts back to
 * generateDrafts.
 */
export async function draftRedditForSub(
  moment: RedditMomentInput,
  sub: SubredditView,
  relevantCommits: CommitRow[],
  relevantNotes: NoteRow[],
  ctx: RedditDraftContext,
): Promise<{ title: string; body: string; usage: AnthropicUsage }> {
  const userMessage = buildRedditDraftMessage({
    moment,
    sub,
    relevantCommits,
    relevantNotes,
    userBannedWords: ctx.userBannedWords,
    styleNotes: ctx.styleNotes,
    voiceExamples: ctx.voiceExamples,
  });

  const tool = buildRedditDraftTool();

  const response = await ctx.client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: DRAFT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: REDDIT_DRAFT_TOOL_NAME },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude didn't call ${REDDIT_DRAFT_TOOL_NAME} for ${sub.displayName}. Stop reason: ${response.stop_reason}.`,
    );
  }

  const input = toolUse.input as { title?: unknown; body?: unknown };
  if (
    typeof input.title !== "string" ||
    input.title.trim().length === 0 ||
    typeof input.body !== "string" ||
    input.body.trim().length === 0
  ) {
    throw new Error(
      `Claude returned a malformed Reddit draft for ${sub.displayName}.`,
    );
  }

  return {
    title: input.title.trim(),
    body: input.body.trim(),
    usage: response.usage,
  };
}

export type RedditGenerationResult = {
  /** Number of Reddit drafts inserted (one per sub generated). */
  count: number;
  subs: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

/** A slug not found in the catalog (e.g. removed after selection) still drafts,
 *  using a generic steer. Synthesise a minimal view for it. */
function fallbackSubView(slug: string): SubredditView {
  return {
    slug,
    displayName: `r/${slug}`,
    toneNote: null,
    selfPromoRule: null,
    prePostChecklist: null,
    flairHint: null,
    submitUrl: submitUrlFor(slug),
  };
}

/** Resolve selected slugs to catalog views, falling back to a generic view for
 *  any slug no longer in the catalog. */
function resolveSubViews(
  slugs: string[],
  catalog: SubredditView[],
): SubredditView[] {
  const bySlug = new Map(catalog.map((s) => [s.slug, s]));
  return slugs.map((slug) => bySlug.get(slug) ?? fallbackSubView(slug));
}

/** Validate, normalise, dedupe (case-insensitive), and cap a list of slugs. */
function validateSubSlugs(raw: string[]): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const s of raw) {
    if (typeof s !== "string") continue;
    const slug = normalizeSlug(s);
    const key = slug.toLowerCase();
    if (isValidSlug(slug) && !seen.has(key)) {
      seen.add(key);
      slugs.push(slug);
    }
  }
  return slugs.slice(0, MAX_SUBS_PER_GENERATE);
}

/**
 * On-demand Reddit generation from the dashboard: for one existing moment and
 * up to MAX_SUBS_PER_GENERATE subs, generate one tailored journey-format draft
 * per sub and persist it. Each draft is an independent Claude call (parallel),
 * reusing the cached system prompt. Reuses the moment's source material, the
 * user's banned-words/style settings, and reddit-only starred voice examples.
 *
 * Re-running for a sub replaces that sub's still-in-'draft' row (it doesn't
 * stack duplicates, and never clobbers an approved/posted Reddit draft).
 */
export async function generateRedditDrafts(args: {
  momentId: number;
  subs: string[];
}): Promise<RedditGenerationResult> {
  // ── Validate + normalise + dedupe + cap subs (freeform slugs now) ─────
  const slugs = validateSubSlugs(args.subs);
  if (slugs.length === 0) {
    throw new Error("Select at least one valid subreddit.");
  }

  const key = getAnthropicKey();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it in Settings first.");
  }

  const moment = await getMomentById(args.momentId);
  if (!moment) {
    throw new Error(`Moment ${args.momentId} not found.`);
  }

  // ── Load source material + prefs + reddit voice examples + catalog ────
  const [allCommits, userBannedWords, styleNotes, voiceExamples, catalog] =
    await Promise.all([
      getRecentCommits(500),
      getBannedWords(),
      getStyleNotes(),
      getStarredExamples(10, "reddit"),
      getSubreddits(),
    ]);

  const subViews = resolveSubViews(slugs, catalog.map(toView));

  // Filter to just this moment's referenced source material (same shape as
  // draftMoment): commits by SHA prefix, notes by numeric id.
  const relevantCommits = allCommits.filter((c) =>
    moment.source_refs.some((ref) => c.sha === ref || c.sha.startsWith(ref)),
  );
  const noteIds = moment.source_refs.filter((r) => /^\d+$/.test(r.trim()));
  const relevantNotes = (
    await Promise.all(noteIds.map((id) => getNoteById(Number(id))))
  ).filter((n): n is NoteRow => n !== null);

  const client = new Anthropic({
    apiKey: key,
    maxRetries: 0,
    timeout: ANTHROPIC_TIMEOUT_MS, // fail fast on a stalled call
  });
  const ctx: RedditDraftContext = {
    client,
    userBannedWords,
    styleNotes,
    voiceExamples,
  };

  // ── Generate all subs in parallel ─────────────────────────────────────
  const drafts = await Promise.all(
    subViews.map((sub) =>
      draftRedditForSub(
        {
          summary: moment.summary,
          source_type: moment.source_type,
          source_refs: moment.source_refs,
        },
        sub,
        relevantCommits,
        relevantNotes,
        ctx,
      ).then((r) => ({ slug: sub.slug, ...r })),
    ),
  );

  // ── Persist (replace any prior still-draft row per sub) ───────────────
  for (const d of drafts) {
    await deleteRedditDraftsForSub(args.momentId, d.slug);
    await insertRedditDraft({
      momentId: args.momentId,
      subreddit: d.slug,
      title: d.title,
      content: d.body,
    });
  }

  const totals = aggregateUsage(drafts.map((d) => d.usage));
  return { count: drafts.length, subs: slugs, ...totals };
}

// ── Per-repo Reddit auto-generation (dashboard Generate path) ────────────

// Ceiling for the whole Reddit pass for one repo. The 3-sub cap + per-call
// Anthropic 60s timeout + parallelism keep real time well under this; it's a
// backstop so a stall surfaces a clear error instead of hanging.
const REDDIT_PASS_TIMEOUT_MS = 90_000;

/**
 * Auto-generate Reddit drafts for one repo's just-finished generation, using
 * that repo's saved sub selection (Settings → Reddit auto-generation). Runs as
 * a separate bounded pass after the main X/IH generation, mirroring the
 * on-demand `generateRedditDrafts` persistence (replace a still-draft row per
 * moment×sub; never clobber approved/posted).
 *
 * Opt-in: if the repo has no subs selected, returns `{ count: 0 }` with NO
 * Claude calls (cost-neutral vs today).
 */
export async function generateRedditForRepo(
  repo: string,
  generationId: string,
): Promise<RedditGenerationResult> {
  const empty: RedditGenerationResult = {
    count: 0,
    subs: [],
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };

  const subs = await getRedditSubs(repo); // string[] of slugs
  if (subs.length === 0) return empty; // opt-in: off for this repo, no calls

  const moments = await getMomentsByGeneration(generationId);
  if (moments.length === 0) return { ...empty, subs };

  const key = getAnthropicKey();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it in Settings first.");
  }

  // Resolve the saved slugs against the catalog (generic fallback for any that
  // were removed). The 3-cap was already applied when the selection was saved.
  const catalog = (await getSubreddits()).map(toView);
  const subViews = resolveSubViews(subs, catalog);

  return withTimeout(
    runRedditPass(subViews, moments, key),
    REDDIT_PASS_TIMEOUT_MS,
    `Reddit auto-generation timed out for ${repo}`,
  );
}

/** The actual (moment × sub) draft + persist pass. Split out so the whole
 *  thing is a single promise withTimeout can race. */
async function runRedditPass(
  subViews: SubredditView[],
  moments: MomentWithDrafts[],
  key: string,
): Promise<RedditGenerationResult> {
  // Load shared source material + prefs + reddit voice examples once.
  const [allCommits, userBannedWords, styleNotes, voiceExamples] =
    await Promise.all([
      getRecentCommits(500),
      getBannedWords(),
      getStyleNotes(),
      getStarredExamples(10, "reddit"),
    ]);

  const client = new Anthropic({
    apiKey: key,
    maxRetries: 0,
    timeout: ANTHROPIC_TIMEOUT_MS,
  });
  const ctx: RedditDraftContext = {
    client,
    userBannedWords,
    styleNotes,
    voiceExamples,
  };

  // Build the (moment × sub) work list. Resolve each moment's relevant source
  // material once (commits by SHA prefix; notes by numeric id), then fan the
  // subs out across it.
  type Job = {
    momentId: number;
    moment: { summary: string; source_type: string; source_refs: string[] };
    sub: SubredditView;
    relevantCommits: CommitRow[];
    relevantNotes: NoteRow[];
  };
  const jobs: Job[] = [];
  for (const m of moments) {
    const relevantCommits = allCommits.filter((c) =>
      m.source_refs.some((ref) => c.sha === ref || c.sha.startsWith(ref)),
    );
    const noteIds = m.source_refs.filter((r) => /^\d+$/.test(r.trim()));
    const relevantNotes = (
      await Promise.all(noteIds.map((id) => getNoteById(Number(id))))
    ).filter((n): n is NoteRow => n !== null);
    for (const sub of subViews) {
      jobs.push({
        momentId: m.id,
        moment: {
          summary: m.summary,
          source_type: m.source_type,
          source_refs: m.source_refs,
        },
        sub,
        relevantCommits,
        relevantNotes,
      });
    }
  }

  // Draft every (moment × sub) in parallel.
  const drafted = await Promise.all(
    jobs.map((job) =>
      draftRedditForSub(
        job.moment,
        job.sub,
        job.relevantCommits,
        job.relevantNotes,
        ctx,
      ).then((r) => ({ momentId: job.momentId, slug: job.sub.slug, ...r })),
    ),
  );

  // Persist — replace any prior still-draft row per (moment × sub).
  for (const d of drafted) {
    await deleteRedditDraftsForSub(d.momentId, d.slug);
    await insertRedditDraft({
      momentId: d.momentId,
      subreddit: d.slug,
      title: d.title,
      content: d.body,
    });
  }

  const totals = aggregateUsage(drafted.map((d) => d.usage));
  return { count: drafted.length, subs: subViews.map((s) => s.slug), ...totals };
}

// ── User-message builders ─────────────────────────────────────────────────

function buildIdentifyMessage(args: {
  commits: CommitRow[];
  notes: NoteRow[];
  userBannedWords: string[];
  styleNotes: string;
  voiceExamples: HistoryDraft[];
  windowDays: number;
  maxMoments: number;
  repoFilter: string | null;
}): string {
  const parts: string[] = [];
  const windowLabel = `last ${args.windowDays} day${args.windowDays === 1 ? "" : "s"}`;

  parts.push(`# Material from the ${windowLabel}\n`);

  if (args.repoFilter) {
    parts.push(`*Scoped to project: \`${args.repoFilter}\`.*\n`);
  }

  if (args.commits.length > 0) {
    parts.push(`## Commits (${windowLabel}, newest first)\n`);
    for (const c of args.commits) {
      parts.push(
        `- ${c.repo} \`${c.sha.slice(0, 7)}\` (${c.committed_at.toISOString()}) — ${firstLine(c.message)}`,
      );
    }
    parts.push("");
  } else {
    parts.push(`## Commits\n\nNo commits in the ${windowLabel}.\n`);
  }

  if (args.notes.length > 0) {
    parts.push(`## Notes (${windowLabel}, newest first)\n`);
    for (const n of args.notes) {
      parts.push(`### Note ${n.id} (${n.created_at.toISOString()})\n${n.content}\n`);
    }
  } else {
    parts.push(`## Notes\n\nNo notes in the ${windowLabel}.\n`);
  }

  parts.push("\n---\n");
  appendSharedPreferences(parts, args);

  const lowerHint = Math.max(1, Math.floor(args.maxMoments * 0.6));
  parts.push(
    `Identify ${lowerHint}-${args.maxMoments} moments worth posting about. If the ${windowLabel} is thin, return fewer (or zero) rather than padding with weak ones. For each moment, return ONLY the summary, source_type, and source_refs — the actual drafted posts come in a separate follow-up call so you don't need to write them now. Call submit_moments with the result.`,
  );

  return parts.join("\n");
}

function buildDraftMomentMessage(args: {
  moment: IdentifiedMoment;
  relevantCommits: CommitRow[];
  relevantNotes: NoteRow[];
  userBannedWords: string[];
  styleNotes: string;
  voiceExamples: HistoryDraft[];
}): string {
  const parts: string[] = [];

  parts.push("# Draft both variants for this moment\n");

  parts.push(`**Moment summary:** ${args.moment.summary}`);
  parts.push(`**Source type:** ${args.moment.source_type}`);
  parts.push(`**Source refs:** ${args.moment.source_refs.join(", ") || "(none)"}\n`);

  if (args.relevantCommits.length > 0) {
    parts.push("## Relevant commits\n");
    for (const c of args.relevantCommits) {
      parts.push(
        `- ${c.repo} \`${c.sha.slice(0, 7)}\` (${c.committed_at.toISOString()})\n  ${c.message.replace(/\n/g, "\n  ")}`,
      );
    }
    parts.push("");
  }

  if (args.relevantNotes.length > 0) {
    parts.push("## Relevant notes\n");
    for (const n of args.relevantNotes) {
      parts.push(`### Note ${n.id} (${n.created_at.toISOString()})\n${n.content}\n`);
    }
  }

  parts.push("\n---\n");
  appendSharedPreferences(parts, args);

  parts.push(
    "Draft both variants — an X thread and an Indie Hackers long-form post — for the moment above. Match the voice rules in the system prompt and the user's starred examples. Call submit_moment_drafts with both variants.",
  );

  return parts.join("\n");
}

function buildRedditDraftMessage(args: {
  moment: RedditMomentInput;
  sub: SubredditView;
  relevantCommits: CommitRow[];
  relevantNotes: NoteRow[];
  userBannedWords: string[];
  styleNotes: string;
  voiceExamples: HistoryDraft[];
}): string {
  const sub = args.sub;
  const parts: string[] = [];

  parts.push(`# Draft a Reddit post for ${sub.displayName}\n`);

  parts.push(`**Moment summary:** ${args.moment.summary}`);
  parts.push(`**Source type:** ${args.moment.source_type}`);
  parts.push(
    `**Source refs:** ${args.moment.source_refs.join(", ") || "(none)"}\n`,
  );

  if (args.relevantCommits.length > 0) {
    parts.push("## Relevant commits\n");
    for (const c of args.relevantCommits) {
      parts.push(
        `- ${c.repo} \`${c.sha.slice(0, 7)}\` (${c.committed_at.toISOString()})\n  ${c.message.replace(/\n/g, "\n  ")}`,
      );
    }
    parts.push("");
  }

  if (args.relevantNotes.length > 0) {
    parts.push("## Relevant notes\n");
    for (const n of args.relevantNotes) {
      parts.push(`### Note ${n.id} (${n.created_at.toISOString()})\n${n.content}\n`);
    }
  }

  parts.push("\n---\n");

  // Per-sub steering — the heart of "tailored, not relabelled" (A0.2). For a
  // bare sub (no tone/rules in the catalog), fall back to a generic journey
  // steer and skip the per-sub tone line entirely.
  parts.push(`## Target subreddit: ${sub.displayName}\n`);
  if (sub.toneNote) {
    parts.push(`**Tone for this sub:** ${sub.toneNote}\n`);
  } else {
    parts.push(
      `**Tone:** Write a genuine build-in-public journey post for this community — honest, specific, first person. (No per-sub tone is configured for ${sub.displayName}.)\n`,
    );
  }
  if (sub.selfPromoRule) {
    parts.push(`**This sub's self-promo norms:** ${sub.selfPromoRule}\n`);
  }

  // Journey-format contract (A0.3) — same guardrails as X/IH, Reddit-shaped.
  parts.push("## Required format — journey post\n");
  parts.push(
    [
      "- **Honest headline** as the title — specific and concrete, no clickbait or hype words.",
      "- **At least one real number** drawn from the source material above. If you don't have a concrete number, write a `[VERIFY]` placeholder rather than inventing one.",
      "- **A 'what went wrong' beat** — the honest friction, mistake, or dead end. The 'beginner learning in public' angle is on-brand; lean in, don't paper over it.",
      "- **One specific insight** the reader takes away — not a list of generic tips.",
      "- **No forced call-to-action.** Don't bolt on 'check out my product' or 'follow me'. If the product comes up at all, it's woven into the story, not a pitch.",
      "- Mark anything uncertain with `[VERIFY]`. Hallucinated specifics are worse than admitting a gap.",
      "- Plain prose for the body. No markdown headers inside the post. No hashtags. Emoji only if it genuinely earns its place.",
    ].join("\n"),
  );
  parts.push("");

  appendSharedPreferences(parts, args);

  parts.push(
    `Write the title and body for a ${sub.displayName} post about the moment above, following the journey-format contract and this sub's tone. Tailor it to ${sub.displayName} specifically — do not produce generic text that would read identically on another sub. Call ${REDDIT_DRAFT_TOOL_NAME} with the title and body.`,
  );

  return parts.join("\n");
}

/** Shared block — banned words, style notes, voice examples. Used by both
 *  the identify and draft user messages. */
function appendSharedPreferences(
  parts: string[],
  args: {
    userBannedWords: string[];
    styleNotes: string;
    voiceExamples: HistoryDraft[];
  },
): void {
  if (args.userBannedWords.length > 0) {
    parts.push("## User-configured banned words (in addition to the system prompt's list)\n");
    parts.push(args.userBannedWords.map((w) => `- ${w}`).join("\n"));
    parts.push("");
  }

  if (args.styleNotes.trim().length > 0) {
    parts.push("## User-configured style notes\n");
    parts.push(args.styleNotes.trim());
    parts.push("");
  }

  if (args.voiceExamples.length > 0) {
    parts.push(
      `## Voice examples (${args.voiceExamples.length} starred posts from history)`,
    );
    parts.push(
      "These are drafts the user marked as ★ — posts that worked for them. Match the rhythm, sentence length, sentence structure, and degree of specificity. Do NOT copy them. Do NOT pastiche them. Use them as a tuning signal for the voice rules in the system prompt.",
    );
    parts.push("");
    for (let i = 0; i < args.voiceExamples.length; i++) {
      const ex = args.voiceExamples[i];
      const label = variantLabel(ex.variant, ex.subreddit);
      const postedLabel = ex.status === "posted" ? " · posted" : "";
      parts.push(`### Example ${i + 1} (${label}${postedLabel})`);
      parts.push(ex.content);
      parts.push("");
    }
    parts.push("---\n");
  }
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i === -1 ? s : s.slice(0, i);
}

// ── deriveMomentRepo (unchanged) ─────────────────────────────────────────

/**
 * Best-effort: figure out which watched repo a moment is about, based on its
 * source refs. Returns the common repo if all refs point to the same one,
 * otherwise null. Used to persist `moments.repo` for history filtering.
 *
 * Each ref might be:
 *   - a short or full commit SHA (hex chars only)
 *   - a numeric note id
 *
 * We try both lookups per ref. Cheap — only runs once per moment at insert.
 */
async function deriveMomentRepo(
  _sourceType: string,
  sourceRefs: string[],
): Promise<string | null> {
  const repos = new Set<string>();
  for (const ref of sourceRefs) {
    const trimmed = ref.trim();
    if (!trimmed) continue;

    // Try as a note id first (numeric).
    if (/^\d+$/.test(trimmed)) {
      const note = await getNoteById(Number(trimmed));
      if (note?.repo) repos.add(note.repo);
      continue;
    }

    // Try as a commit SHA prefix (hex chars). LIKE '<prefix>%' matches both
    // short SHAs (the format we feed Claude) and full SHAs.
    if (/^[0-9a-f]{4,40}$/i.test(trimmed)) {
      const matchedRepos = await getReposForShaPrefix(trimmed);
      for (const r of matchedRepos) repos.add(r);
    }
  }

  if (repos.size === 1) {
    return Array.from(repos)[0];
  }
  return null;
}

// ── Parsing / validation ─────────────────────────────────────────────────

/** Validate Claude's identify tool_use input shape. */
function parseIdentifiedMoments(input: unknown): IdentifiedMoment[] {
  if (!input || typeof input !== "object") {
    throw new Error("identifyMoments: tool input was not an object.");
  }
  const obj = input as { moments?: unknown };
  if (!Array.isArray(obj.moments)) {
    throw new Error("identifyMoments: tool input missing 'moments' array.");
  }
  const result: IdentifiedMoment[] = [];
  for (const m of obj.moments) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    if (
      typeof o.summary !== "string" ||
      typeof o.source_type !== "string" ||
      !Array.isArray(o.source_refs)
    ) {
      continue;
    }
    result.push({
      summary: o.summary,
      source_type: o.source_type,
      source_refs: o.source_refs.filter(
        (s): s is string => typeof s === "string",
      ),
    });
  }
  return result;
}

/** Sum input/output/cache token counts across all Anthropic calls in a run. */
function aggregateUsage(usages: AnthropicUsage[]): {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
} {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  for (const u of usages) {
    inputTokens += u.input_tokens;
    outputTokens += u.output_tokens;
    cacheReadTokens += u.cache_read_input_tokens ?? 0;
    cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
  }
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
  };
}
