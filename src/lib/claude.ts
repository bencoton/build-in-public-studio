import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";

import { getAnthropicKey } from "./env-keys";
import { getBannedWords, getStyleNotes } from "./settings";
import { getRecentNotes } from "./notes";
import { getRecentCommits } from "./commits";
import { insertMomentWithDrafts } from "./moments";
import { DRAFT_SYSTEM_PROMPT } from "@/prompts/draft-system";

/*
  The main "generate this week's drafts" call.

  Design notes:
  - Uses tool_use with a strict input_schema. Claude is forced to call the
    submit_drafts tool — never replies as plain text. Output shape guaranteed.
  - System prompt + tool schema have cache_control so they cache across calls;
    regenerates get ~90% off the cached portion.
  - SDK maxRetries: 0 per WyCo Tech-Stack rule 20 — we handle retries at the
    app layer if needed.
  - Model: claude-sonnet-4-6 per WyCo Tech-Stack default.
*/

const MODEL = "claude-sonnet-4-6";

// The schema Claude must satisfy. Per WyCo lessons: keep minItems low (1, not
// 3) and encourage 3-5 in the prompt — over-constraining produces empty arrays.
const DRAFT_TOOL = {
  name: "submit_drafts",
  description:
    "Submit the moments you've identified for this week and their drafted posts. Always call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      moments: {
        type: "array",
        minItems: 0,
        maxItems: 5,
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
                "Identifiers for the commits or notes that informed this moment — short SHAs for commits, note IDs for notes.",
            },
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
          required: ["summary", "source_type", "source_refs", "x_thread", "ih_long"],
        },
      },
    },
    required: ["moments"],
  },
} as const;

export type GeneratedMoment = {
  summary: string;
  source_type: string;
  source_refs: string[];
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

/**
 * Pull this week's commits + notes + user settings, call Claude with the
 * structured-output tool, persist the result, return a summary.
 */
export async function generateDrafts(): Promise<GenerationResult> {
  const key = getAnthropicKey();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it in Settings first.");
  }

  // Window: last 7 days, matching the GitHub sync window.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Pull commits and notes from the last 7 days. The commits table already
  // contains only the synced ones, but we filter again here so a stale cache
  // doesn't leak older commits in if the user hasn't synced recently.
  const allCommits = getRecentCommits(500);
  const commits = allCommits.filter((c) => new Date(c.committed_at) >= cutoff);

  const allNotes = getRecentNotes(200);
  const notes = allNotes.filter((n) => parseTimestamp(n.created_at) >= cutoff);

  if (commits.length === 0 && notes.length === 0) {
    throw new Error(
      "No commits or notes from the last 7 days. Sync GitHub or add a note first.",
    );
  }

  const userBannedWords = getBannedWords();
  const styleNotes = getStyleNotes();
  const userMessage = buildUserMessage({
    commits,
    notes,
    userBannedWords,
    styleNotes,
  });

  const client = new Anthropic({
    apiKey: key,
    maxRetries: 0, // WyCo Tech-Stack rule 20
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    // System prompt array form lets us attach cache_control. The string form
    // doesn't support per-block cache control.
    system: [
      {
        type: "text",
        text: DRAFT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        ...DRAFT_TOOL,
        cache_control: { type: "ephemeral" },
      },
    ],
    tool_choice: { type: "tool", name: DRAFT_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract the tool_use block — there should be exactly one.
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude didn't call submit_drafts. Stop reason: ${response.stop_reason}.`,
    );
  }
  if (toolUse.name !== DRAFT_TOOL.name) {
    throw new Error(`Claude called unexpected tool: ${toolUse.name}.`);
  }

  const parsed = parseMomentsPayload(toolUse.input);

  // Persist. Each generation gets a UUID so we can group its moments later.
  const generationId = randomUUID();
  for (const moment of parsed) {
    insertMomentWithDrafts({
      summary: moment.summary,
      sourceType: moment.source_type,
      sourceRefs: moment.source_refs,
      generationId,
      xThread: moment.x_thread,
      ihLong: moment.ih_long,
    });
  }

  return {
    generationId,
    momentCount: parsed.length,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildUserMessage(args: {
  commits: ReturnType<typeof getRecentCommits>;
  notes: ReturnType<typeof getRecentNotes>;
  userBannedWords: string[];
  styleNotes: string;
}): string {
  const parts: string[] = [];

  parts.push("# This week's material\n");

  if (args.commits.length > 0) {
    parts.push("## Commits (last 7 days, newest first)\n");
    for (const c of args.commits) {
      parts.push(
        `- ${c.repo} \`${c.sha.slice(0, 7)}\` (${c.committed_at}) — ${firstLine(c.message)}`,
      );
    }
    parts.push("");
  } else {
    parts.push("## Commits\n\nNo commits in the last 7 days.\n");
  }

  if (args.notes.length > 0) {
    parts.push("## Notes (last 7 days, newest first)\n");
    for (const n of args.notes) {
      parts.push(`### Note ${n.id} (${n.created_at})\n${n.content}\n`);
    }
  } else {
    parts.push("## Notes\n\nNo notes in the last 7 days.\n");
  }

  parts.push("\n---\n");

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

  parts.push(
    "Identify 3-5 moments worth posting about. If the week is thin, return fewer (or zero) rather than padding with weak ones. Call submit_drafts with the result.",
  );

  return parts.join("\n");
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i === -1 ? s : s.slice(0, i);
}

function parseTimestamp(s: string): Date {
  return new Date(s.replace(" ", "T") + (s.endsWith("Z") ? "" : "Z"));
}

/**
 * Validate Claude's tool_use input matches our expected shape. tool_use
 * guarantees the schema, but cheap to double-check at runtime so a future
 * schema change doesn't silently corrupt the DB.
 */
function parseMomentsPayload(input: unknown): GeneratedMoment[] {
  if (!input || typeof input !== "object") {
    throw new Error("Tool input was not an object.");
  }
  const obj = input as { moments?: unknown };
  if (!Array.isArray(obj.moments)) {
    throw new Error("Tool input missing 'moments' array.");
  }
  const result: GeneratedMoment[] = [];
  for (const m of obj.moments) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    if (
      typeof o.summary !== "string" ||
      typeof o.source_type !== "string" ||
      typeof o.x_thread !== "string" ||
      typeof o.ih_long !== "string" ||
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
      x_thread: o.x_thread,
      ih_long: o.ih_long,
    });
  }
  return result;
}
