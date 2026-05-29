import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";

import { getAnthropicKey } from "./env-keys";
import { getBannedWords, getStyleNotes } from "./settings";
import { getRecentNotes, getNoteById, type NoteRow } from "./notes";
import {
  getRecentCommits,
  getReposForShaPrefix,
  type CommitRow,
} from "./commits";
import { insertMomentWithDrafts } from "./moments";
import { getStarredExamples, type HistoryDraft } from "./history";
import { stagger } from "./scheduling";
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

const IDENTIFY_TOOL_NAME = "submit_moments";
const DRAFT_MOMENT_TOOL_NAME = "submit_moment_drafts";

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
    notes = notes.filter((n) => n.repo === repoFilter);
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
  });

  const context: SharedContext = {
    client,
    userBannedWords,
    styleNotes,
    voiceExamples,
    commits,
    notes,
  };

  // ── Phase 1: identify moments ─────────────────────────────────────────
  const identifyResult = await identifyMoments(context, {
    windowDays,
    maxMoments,
    repoFilter,
  });

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
  const draftResults = await Promise.all(
    identifyResult.moments.map((moment) => draftMoment(moment, context)),
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
      const variantLabel =
        ex.variant === "x_thread" ? "X thread" : "Indie Hackers long-form";
      const postedLabel = ex.status === "posted" ? " · posted" : "";
      parts.push(`### Example ${i + 1} (${variantLabel}${postedLabel})`);
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
