import Anthropic from "@anthropic-ai/sdk";

import { scanTells, CATALOG_BANNED_WORDS } from "./tell-scanner";

/*
  humanize() — a standalone, app-agnostic pass that strips the stylistic "AI
  tells" (em-dash overuse, "not just X, it's Y", sycophantic openers, stiff
  register, inflated importance, overused diction) out of already-generated
  text, while preserving meaning, numbers, and [VERIFY] markers.

  Spec: docs/SPEC-humanizer.md (Phase 1, P0). Design constraints honoured here:
  - Imports NOTHING from this app's domain code (no db, settings, moment types).
    The only sibling import is the pure tell-scanner, itself app-agnostic.
  - Caller supplies the API key, voice examples (raw strings), banned words, and
    style notes — no env coupling.
  - Default passes = ["tells"] + audit. The voice pass runs only when
    opts.passes includes "voice". Order: voice (adds) → tells (removes) → audit.
  - Anthropic SDK is used the same way src/lib/claude.ts does it: Sonnet,
    maxRetries 0, a 60s per-call timeout, forced tool_use for structured output.
  - No prompt caching in v1 (single on-demand calls — caching earns nothing).
  - No new npm dependency.
*/

const DEFAULT_MODEL = "claude-sonnet-4-6";

// Per-call ceiling on every Anthropic request (matches claude.ts). Without it
// the SDK waits up to its long default, so a stalled connection hangs the call.
const ANTHROPIC_TIMEOUT_MS = 60_000;

// Headroom for a full Indie Hackers long-form (~600 words) plus the change list.
const MAX_TOKENS = 4096;

const REWRITE_TOOL_NAME = "submit_rewrite";

export type HumanizePass = "voice" | "tells";

export type HumanizeFormat = "x_thread" | "ih_long" | "reddit" | "plain";

export type HumanizeOptions = {
  /** Caller supplies the Anthropic key — no env coupling. */
  apiKey: string;
  /** Raw strings of the author's own posts; the caller maps its own types. */
  voiceExamples?: string[];
  /** Merged with the built-in catalog diction list. */
  bannedWords?: string[];
  styleNotes?: string;
  /** Default ["tells"]; ["voice","tells"] = full. */
  passes?: HumanizePass[];
  /** Default true — self-audit + one corrective rewrite. */
  audit?: boolean;
  /** Light format guardrails injected into the prompt. Default "plain". */
  format?: HumanizeFormat;
  /** Default the app's Sonnet model. */
  model?: string;
  /** Honour a caller timeout / cancellation. */
  signal?: AbortSignal;
};

export type HumanizeUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

export type HumanizeResult = {
  text: string;
  tellsBefore: number;
  tellsAfter: number;
  /** Short human-readable list of what the passes changed. */
  changes: string[];
  usage: HumanizeUsage;
};

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

// ── Structured-output tool ─────────────────────────────────────────────────

const REWRITE_TOOL = {
  name: REWRITE_TOOL_NAME,
  description:
    "Submit the rewritten text and a short list of the changes you made. Always call this exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description:
          "The full rewritten text. Same meaning, facts, numbers, links, @handles, and [VERIFY] markers as the input — only the stylistic tells removed.",
      },
      changes: {
        type: "array",
        items: { type: "string" },
        description:
          "A short bullet list (3-8 items) of the concrete edits you made, e.g. 'removed 4 em-dashes', 'added contractions', 'cut the wrap-up paragraph'.",
      },
    },
    required: ["text", "changes"],
  },
};

// ── System prompts (stable; the variable per-call content lives in the user
//    message so it's clear these never change between calls) ────────────────

// The merged evidence-ranked tells catalog from Appendix A is baked in here.
const TELLS_SYSTEM_PROMPT = `You are an editor whose single job is to make already-written text stop reading like AI-generated prose, WITHOUT changing what it says.

Rewrite the text the user gives you to remove the stylistic "tells" below. Preserve the meaning, every fact, every number, every link, every @handle, and every [VERIFY] marker exactly. Never invent specifics. Never add facts. Never remove a [VERIFY] marker. If you are unsure about a fact, leave it exactly as written.

## The tells to remove (ordered by how strongly readers associate them with AI)

Cosmetic / punctuation
1. Em-dash overuse — prefer commas, periods, or parentheses; at most one em-dash per paragraph, ideally none.
2. Metronomic rhythm (every sentence the same length) — vary sentence length deliberately; allow short fragments.

Structural
3. Rigid intro–body–conclusion mould — let the structure follow the argument; drop the tidy wrap-up paragraph ("In conclusion", "All in all").
4. Predictable listicle/triad scaffolding ("There are three reasons…") — use a list only when the content genuinely is one.

Conversational artifacts
5. Sycophantic / canned openers ("Great question!", "I'm excited to share", "Let's dive in") — cut them; open on a concrete detail.
6. Missing contractions / stiff register — use contractions ("it's", "don't", "I've") and match the platform's casualness.

Fake depth / inflated importance
7. "Not just X, it's Y" / antithetical see-saw constructions — state the point directly.
8. Inflated importance ("game-changer", "fundamentally transforms", "groundbreaking") — downgrade to what actually happened.
9. Hollow profundity (grand closing abstractions, "at its core", "a testament to") — end on the specific, not the sweeping.

Diction
10. Overused words (delve, leverage, seamless, tapestry, revolutionize, unlock, robust, navigate used figuratively, realm) — replace with plain synonyms. The user message lists additional banned words; honour those too.

## Rules

- Keep the author's voice. This is a de-slop pass, not a rewrite-from-scratch — change only what reads as machine-written.
- Do not make the text longer. Shorter is usually better.
- Keep the same overall format (a thread stays a thread, a long-form post stays long-form).
- Output ONLY via the ${REWRITE_TOOL_NAME} tool. Never reply in plain prose.`;

const VOICE_SYSTEM_PROMPT = `You are an editor strengthening a piece of writing so it sounds like the specific human author who wrote it, using the author's own past posts and style notes as the reference.

Rewrite the text the user gives you to add what AI prose usually lacks: a first-person point of view, a real opinion, varied sentence rhythm, and concrete specific detail. Calibrate the voice to the author's starred examples and style notes in the user message — match THEIR rhythm and register, do not invent a generic "human" voice and do not pastiche the examples.

Preserve the meaning, every fact, every number, every link, every @handle, and every [VERIFY] marker exactly. Never invent specifics. Never remove a [VERIFY] marker.

Output ONLY via the ${REWRITE_TOOL_NAME} tool. Never reply in plain prose.`;

const AUDIT_SYSTEM_PROMPT = `You are doing a final audit pass on text that has already been edited to remove AI tells.

First, think about what would still tip a careful reader off that this was written by an AI — any residual em-dashes, even cadence, hollow closing lines, stiff phrasing, or overused words that survived. Then produce ONE corrective rewrite that fixes the residue.

Preserve the meaning, every fact, every number, every link, every @handle, and every [VERIFY] marker exactly. Do not lengthen the text. Keep the author's voice and the same overall format.

Output ONLY via the ${REWRITE_TOOL_NAME} tool: the corrected text plus a short list of the residual tells you fixed.`;

// ── Public entry point ─────────────────────────────────────────────────────

export async function humanize(
  text: string,
  opts: HumanizeOptions,
): Promise<HumanizeResult> {
  if (!opts.apiKey) {
    throw new Error("humanize: apiKey is required.");
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const passes =
    opts.passes && opts.passes.length > 0 ? opts.passes : ["tells"];
  const doAudit = opts.audit ?? true;
  const format: HumanizeFormat = opts.format ?? "plain";
  const bannedWords = mergeBannedWords(opts.bannedWords);

  const tellsBefore = scanTells(text, { bannedWords }).total;

  const client = new Anthropic({
    apiKey: opts.apiKey,
    maxRetries: 0, // caller handles retries if it wants them
    timeout: ANTHROPIC_TIMEOUT_MS, // fail fast on a stalled call
  });

  const usages: AnthropicUsage[] = [];
  const changes: string[] = [];
  let current = text;

  // Order matters: voice ADDS, tells REMOVES, audit catches residue.
  if (passes.includes("voice")) {
    const r = await runPass(client, {
      system: VOICE_SYSTEM_PROMPT,
      userMessage: buildUserMessage("voice", current, {
        bannedWords: opts.bannedWords ?? [],
        styleNotes: opts.styleNotes ?? "",
        voiceExamples: opts.voiceExamples ?? [],
        format,
      }),
      model,
      signal: opts.signal,
    });
    current = r.text;
    usages.push(r.usage);
    changes.push(...r.changes);
  }

  if (passes.includes("tells")) {
    const r = await runPass(client, {
      system: TELLS_SYSTEM_PROMPT,
      userMessage: buildUserMessage("tells", current, {
        bannedWords: opts.bannedWords ?? [],
        styleNotes: opts.styleNotes ?? "",
        voiceExamples: [], // tells pass doesn't need the examples
        format,
      }),
      model,
      signal: opts.signal,
    });
    current = r.text;
    usages.push(r.usage);
    changes.push(...r.changes);
  }

  if (doAudit) {
    const r = await runPass(client, {
      system: AUDIT_SYSTEM_PROMPT,
      userMessage: buildUserMessage("audit", current, {
        bannedWords: opts.bannedWords ?? [],
        styleNotes: opts.styleNotes ?? "",
        voiceExamples: [],
        format,
      }),
      model,
      signal: opts.signal,
    });
    current = r.text;
    usages.push(r.usage);
    changes.push(...r.changes);
  }

  const tellsAfter = scanTells(current, { bannedWords }).total;

  return {
    text: current,
    tellsBefore,
    tellsAfter,
    changes,
    usage: aggregateUsage(usages),
  };
}

// ── One Claude call (a single pass) ────────────────────────────────────────

async function runPass(
  client: Anthropic,
  args: {
    system: string;
    userMessage: string;
    model: string;
    signal?: AbortSignal;
  },
): Promise<{ text: string; changes: string[]; usage: AnthropicUsage }> {
  const response = await client.messages.create(
    {
      model: args.model,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: args.system }],
      tools: [REWRITE_TOOL],
      tool_choice: { type: "tool", name: REWRITE_TOOL_NAME },
      messages: [{ role: "user", content: args.userMessage }],
    },
    { signal: args.signal },
  );

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `humanize: Claude didn't call ${REWRITE_TOOL_NAME}. Stop reason: ${response.stop_reason}.`,
    );
  }

  const input = toolUse.input as { text?: unknown; changes?: unknown };
  if (typeof input.text !== "string" || input.text.trim().length === 0) {
    throw new Error("humanize: Claude returned an empty rewrite.");
  }

  const changes = Array.isArray(input.changes)
    ? input.changes.filter((c): c is string => typeof c === "string")
    : [];

  return { text: input.text, changes, usage: response.usage };
}

// ── User-message builder ───────────────────────────────────────────────────

function buildUserMessage(
  kind: "voice" | "tells" | "audit",
  text: string,
  ctx: {
    bannedWords: string[];
    styleNotes: string;
    voiceExamples: string[];
    format: HumanizeFormat;
  },
): string {
  const parts: string[] = [];

  const heading =
    kind === "voice"
      ? "# Strengthen the voice of this text"
      : kind === "tells"
        ? "# Remove the AI tells from this text"
        : "# Final audit — remove any residual AI tells";
  parts.push(heading);
  parts.push("");

  const guardrail = formatGuardrail(ctx.format);
  if (guardrail) {
    parts.push(guardrail);
    parts.push("");
  }

  if (ctx.bannedWords.length > 0) {
    parts.push(
      "## Additional banned words (replace these with plain synonyms, on top of the built-in list)",
    );
    parts.push(ctx.bannedWords.map((w) => `- ${w}`).join("\n"));
    parts.push("");
  }

  if (ctx.styleNotes.trim().length > 0) {
    parts.push("## Author's style notes");
    parts.push(ctx.styleNotes.trim());
    parts.push("");
  }

  if (kind === "voice" && ctx.voiceExamples.length > 0) {
    parts.push(
      `## Voice examples (${ctx.voiceExamples.length} of the author's own posts)`,
    );
    parts.push(
      "Match the rhythm, sentence length, and degree of specificity in these. Do NOT copy or pastiche them — use them only as a tuning signal for the author's voice.",
    );
    parts.push("");
    for (let i = 0; i < ctx.voiceExamples.length; i++) {
      parts.push(`### Example ${i + 1}`);
      parts.push(ctx.voiceExamples[i]);
      parts.push("");
    }
  }

  parts.push("---");
  parts.push("");
  parts.push("## Text to rewrite");
  parts.push("");
  parts.push(text);
  parts.push("");
  parts.push("---");
  parts.push("");
  parts.push(
    `Rewrite the text above and call ${REWRITE_TOOL_NAME} with the result and a short change list. Preserve all facts, numbers, links, @handles, and [VERIFY] markers exactly.`,
  );

  return parts.join("\n");
}

/** Light per-format steer (P0 keeps it in-prompt; hard enforcement is P1). */
function formatGuardrail(format: HumanizeFormat): string | null {
  switch (format) {
    case "x_thread":
      return "Format: an X/Twitter thread. Keep the numbered tweet structure (1/, 2/, …) and keep each tweet under 280 characters. No hashtags.";
    case "ih_long":
      return "Format: an Indie Hackers long-form post (roughly 300-600 words, conversational, one clear takeaway). Plain prose, no markdown headers inside the post.";
    case "reddit":
      return "Format: a Reddit self-text post in journey style — honest and specific, plain prose, no markdown headers, no forced call-to-action.";
    case "plain":
    default:
      return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Merge the caller's banned words with the catalog list, deduped (case-insensitive). */
function mergeBannedWords(extra?: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of [...CATALOG_BANNED_WORDS, ...(extra ?? [])]) {
    const t = w.trim();
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/** Sum token usage across all passes, in the shape the app aggregates. */
function aggregateUsage(usages: AnthropicUsage[]): HumanizeUsage {
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
  return { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens };
}
