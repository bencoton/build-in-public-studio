import Anthropic from "@anthropic-ai/sdk";

import { getAnthropicKey } from "./env-keys";
import { getBannedWords, getStyleNotes } from "./settings";
import { getDraftWithMoment, updateDraftContent } from "./draft-mutations";
import { DRAFT_SYSTEM_PROMPT } from "@/prompts/draft-system";

/*
  Single-variant regenerate. Given a draft id, asks Claude to redraft just
  that one variant for the same moment. Much faster and cheaper than the
  full multi-moment generation in claude.ts:
  - Small structured-output schema (one string field)
  - Small user message (one moment, not the whole week)
  - 800-token output cap instead of 4096
  - Sonnet still — quality matters more than speed for content the user will read

  Reuses the same cached system prompt as the full generator so cache hits
  carry over.
*/

const MODEL = "claude-sonnet-4-6";

const REGENERATE_TOOL = {
  name: "submit_variant",
  description: "Submit the redrafted variant.",
  input_schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description:
          "The redrafted post. For x_thread: numbered tweets (1/, 2/, 3/) under 280 chars each. For ih_long: 300-600 words conversational prose.",
      },
    },
    required: ["content"],
  },
} as const;

export type RegenerateResult = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

export async function regenerateDraft(draftId: number): Promise<RegenerateResult> {
  const key = getAnthropicKey();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it in Settings first.");
  }

  const found = await getDraftWithMoment(draftId);
  if (!found) {
    throw new Error(`Draft ${draftId} not found.`);
  }
  const { draft, moment } = found;

  if (draft.variant !== "x_thread" && draft.variant !== "ih_long") {
    throw new Error(`Unknown variant: ${draft.variant}`);
  }

  // source_ref is jsonb — already parsed by Supabase, not a TEXT-of-JSON
  // string like in the SQLite era. So we just type-check the array shape.
  let sourceRefs: string[] = [];
  if (Array.isArray(moment.source_ref)) {
    sourceRefs = moment.source_ref.filter(
      (s): s is string => typeof s === "string",
    );
  }

  const [userBannedWords, styleNotes] = await Promise.all([
    getBannedWords(),
    getStyleNotes(),
  ]);

  const variantLabel =
    draft.variant === "x_thread"
      ? "X thread (numbered tweets, each under 280 chars, strong opening hook)"
      : "Indie Hackers long-form post (300-600 words, conversational, one clear takeaway)";

  const parts: string[] = [
    `# Regenerate one variant`,
    "",
    `Moment summary: ${moment.summary}`,
    `Source type: ${moment.source_type}`,
    sourceRefs.length > 0
      ? `Source refs: ${sourceRefs.join(", ")}`
      : "Source refs: (none recorded)",
    "",
    `Variant to redraft: **${variantLabel}**`,
    "",
    `Previous draft (for reference — produce a meaningfully different version, don't just paraphrase):`,
    "",
    draft.content,
    "",
  ];

  if (userBannedWords.length > 0) {
    parts.push("## User banned words (in addition to the system prompt's list)");
    parts.push(userBannedWords.map((w) => `- ${w}`).join("\n"));
    parts.push("");
  }
  if (styleNotes.trim().length > 0) {
    parts.push("## User style notes");
    parts.push(styleNotes.trim());
    parts.push("");
  }

  parts.push(
    "Call submit_variant with the redrafted post. Do not return prose outside the tool call.",
  );

  const client = new Anthropic({
    apiKey: key,
    maxRetries: 0,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // `cache_control: { type: "ephemeral" }` is accepted by the API but the
    // SDK types we're pinned to (@anthropic-ai/sdk ^0.30.1) don't declare it
    // on TextBlockParam or Tool yet. Cast to any at the per-block level so
    // we keep the prompt-caching behaviour without bumping the SDK major.
    system: [
      {
        type: "text",
        text: DRAFT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ],
    tools: [
      {
        ...REGENERATE_TOOL,
        cache_control: { type: "ephemeral" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ],
    tool_choice: { type: "tool", name: REGENERATE_TOOL.name },
    messages: [{ role: "user", content: parts.join("\n") }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude didn't call submit_variant. Stop reason: ${response.stop_reason}.`,
    );
  }
  const input = toolUse.input as { content?: unknown };
  if (typeof input.content !== "string" || input.content.trim().length === 0) {
    throw new Error("Claude returned an empty redraft.");
  }

  await updateDraftContent(draftId, input.content);

  // Cache token fields exist on the API response but are missing from the
  // SDK's Usage type at ^0.30.1 (same type-lag as cache_control). Widen the
  // shape locally so the rest of the typing stays honest.
  const usage = response.usage as typeof response.usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
  };
}
