// Two Claude generation flows for per-project product summaries:
//
//   - generateWebsiteSummary(repo) → returns a structured object
//     { tagline, intro, features[] } persisted as a single 'website' row.
//
//   - generateLaunchAnnouncement(repo) → returns { x_thread, ih_long }
//     persisted as two rows (launch_x + launch_ih).
//
// Both reuse the cached DRAFT_SYSTEM_PROMPT — same voice rules apply — and
// pull the project's full commit + note history (not just 7 days) so the
// summary has the full picture.

import Anthropic from "@anthropic-ai/sdk";

import { getAnthropicKey } from "./env-keys";
import { getBannedWords, getStyleNotes } from "./settings";
import { getRecentNotes, type NoteRow } from "./notes";
import { getRecentCommits, type CommitRow } from "./commits";
import {
  insertSummary,
  insertLaunchSummary,
  type WebsiteSummaryContent,
} from "./summaries";
import { getStarredExamples, type HistoryDraft } from "./history";
import { DRAFT_SYSTEM_PROMPT } from "@/prompts/draft-system";

const MODEL = "claude-sonnet-4-6";

export type SummaryGenerationResult = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

// ── Website summary ──────────────────────────────────────────────────────

const WEBSITE_TOOL = {
  name: "submit_website_summary",
  description:
    "Submit the structured website summary for the project. Always call this exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      tagline: {
        type: "string",
        description:
          "One-line product description. Under 80 characters. Specific, no marketing fluff. Goes in the hero of the website.",
      },
      intro: {
        type: "string",
        description:
          "2-3 short paragraphs explaining what the product does, who it's for, and how it works. Plain prose, no bullet points, no headings. 80-200 words.",
      },
      features: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "string",
          description:
            "One concrete feature as a short statement. Specific, mentions the actual thing the user does or sees. 10-20 words.",
        },
      },
    },
    required: ["tagline", "intro", "features"],
  },
};

export async function generateWebsiteSummary(
  repo: string,
): Promise<{ summaryId: number; content: WebsiteSummaryContent; usage: SummaryGenerationResult }> {
  const key = getAnthropicKey();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it in Settings first.");
  }

  const [commits, notes, userBannedWords, styleNotes, voiceExamples] =
    await Promise.all([
      collectProjectCommits(repo),
      collectProjectNotes(repo),
      getBannedWords(),
      getStyleNotes(),
      getStarredExamples(6),
    ]);

  if (commits.length === 0 && notes.length === 0) {
    throw new Error(
      `No commits or notes for ${repo}. Sync GitHub or add a project-linked note first.`,
    );
  }

  const userMessage = buildSummaryUserMessage({
    kindLabel: "website summary",
    repo,
    commits,
    notes,
    userBannedWords,
    styleNotes,
    voiceExamples,
    instructions:
      "Produce a structured website summary for this product. Call submit_website_summary with: tagline (one line, <80 chars), intro (2-3 short paragraphs, 80-200 words), features (3-6 specific feature statements). Concrete over generic. Match the voice rules in the system prompt.",
  });

  const client = new Anthropic({ apiKey: key, maxRetries: 0 });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: DRAFT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        ...WEBSITE_TOOL,
        cache_control: { type: "ephemeral" },
      },
    ],
    tool_choice: { type: "tool", name: WEBSITE_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude didn't call submit_website_summary. Stop reason: ${response.stop_reason}.`,
    );
  }
  const input = toolUse.input as Partial<WebsiteSummaryContent>;
  if (
    typeof input.tagline !== "string" ||
    typeof input.intro !== "string" ||
    !Array.isArray(input.features)
  ) {
    throw new Error("Claude returned a malformed website summary.");
  }
  const content: WebsiteSummaryContent = {
    tagline: input.tagline,
    intro: input.intro,
    features: input.features.filter(
      (f): f is string => typeof f === "string",
    ),
  };

  const summaryId = await insertSummary({
    repo,
    kind: "website",
    content: JSON.stringify(content),
  });

  const usage = response.usage;
  return {
    summaryId,
    content,
    usage: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    },
  };
}

// ── Launch announcement ──────────────────────────────────────────────────

const LAUNCH_TOOL = {
  name: "submit_launch_announcement",
  description:
    "Submit the launch announcement posts for the project. Always call this exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      x_thread: {
        type: "string",
        description:
          "Launch announcement as an X / Twitter thread. Numbered tweets (1/, 2/, 3/...) separated by blank lines. Each tweet under 280 characters. 5-9 tweets total. Strong hook, concrete details, clear call to action, link placeholder [LINK].",
      },
      ih_long: {
        type: "string",
        description:
          "Launch announcement as an Indie Hackers long-form post. 400-800 words. Conversational, first-person, tells the story of why and how the product exists. One clear call to action at the end.",
      },
    },
    required: ["x_thread", "ih_long"],
  },
};

export async function generateLaunchAnnouncement(
  repo: string,
): Promise<{ xId: number; ihId: number; xThread: string; ihLong: string; usage: SummaryGenerationResult }> {
  const key = getAnthropicKey();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it in Settings first.");
  }

  const [commits, notes, userBannedWords, styleNotes, voiceExamples] =
    await Promise.all([
      collectProjectCommits(repo),
      collectProjectNotes(repo),
      getBannedWords(),
      getStyleNotes(),
      getStarredExamples(8),
    ]);

  if (commits.length === 0 && notes.length === 0) {
    throw new Error(
      `No commits or notes for ${repo}. Sync GitHub or add a project-linked note first.`,
    );
  }

  const userMessage = buildSummaryUserMessage({
    kindLabel: "launch announcement",
    repo,
    commits,
    notes,
    userBannedWords,
    styleNotes,
    voiceExamples,
    instructions:
      "Draft the launch announcement for this product. Call submit_launch_announcement with both variants: an X thread (numbered tweets, 5-9 of them, each <280 chars) and an Indie Hackers long-form post (400-800 words, conversational first-person). Strong hook, concrete specifics from the project's actual work, single clear call to action. Use [LINK] as a placeholder for the URL.",
  });

  const client = new Anthropic({ apiKey: key, maxRetries: 0 });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3072,
    system: [
      {
        type: "text",
        text: DRAFT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        ...LAUNCH_TOOL,
        cache_control: { type: "ephemeral" },
      },
    ],
    tool_choice: { type: "tool", name: LAUNCH_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude didn't call submit_launch_announcement. Stop reason: ${response.stop_reason}.`,
    );
  }
  const input = toolUse.input as { x_thread?: unknown; ih_long?: unknown };
  if (typeof input.x_thread !== "string" || typeof input.ih_long !== "string") {
    throw new Error("Claude returned a malformed launch announcement.");
  }

  const { xId, ihId } = await insertLaunchSummary({
    repo,
    xThread: input.x_thread,
    ihLong: input.ih_long,
  });

  const usage = response.usage;
  return {
    xId,
    ihId,
    xThread: input.x_thread,
    ihLong: input.ih_long,
    usage: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Pull every commit for a project (cap 500 — beyond that we'd want
 *  summarisation rather than full listing). */
async function collectProjectCommits(repo: string): Promise<CommitRow[]> {
  const all = await getRecentCommits(500);
  return all.filter((c) => c.repo === repo);
}

/** Pull every note linked to a project (cap 200). */
async function collectProjectNotes(repo: string): Promise<NoteRow[]> {
  const all = await getRecentNotes(200);
  return all.filter((n) => n.repo === repo);
}

function buildSummaryUserMessage(args: {
  kindLabel: string;
  repo: string;
  commits: CommitRow[];
  notes: NoteRow[];
  userBannedWords: string[];
  styleNotes: string;
  voiceExamples: HistoryDraft[];
  instructions: string;
}): string {
  const parts: string[] = [];

  parts.push(`# Generate ${args.kindLabel} for ${args.repo}\n`);

  if (args.commits.length > 0) {
    parts.push(`## Commits (${args.commits.length} total, newest first)\n`);
    for (const c of args.commits) {
      parts.push(
        `- \`${c.sha.slice(0, 7)}\` (${c.committed_at.toISOString().slice(0, 10)}) — ${firstLine(c.message)}`,
      );
    }
    parts.push("");
  } else {
    parts.push("## Commits\n\nNo commits for this project yet.\n");
  }

  if (args.notes.length > 0) {
    parts.push(`## Notes linked to this project (${args.notes.length} total)\n`);
    for (const n of args.notes) {
      parts.push(`### Note ${n.id} (${n.created_at.toISOString().slice(0, 10)})\n${n.content}\n`);
    }
  } else {
    parts.push("## Notes\n\nNo notes linked to this project yet.\n");
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

  if (args.voiceExamples.length > 0) {
    parts.push(`## Voice examples (${args.voiceExamples.length} starred posts from history)`);
    parts.push(
      "These are drafts the user marked as ★ — posts that worked for them. Match the rhythm, sentence length, and degree of specificity. Do NOT copy. Use as a tuning signal.",
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

  parts.push(args.instructions);
  return parts.join("\n");
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i === -1 ? s : s.slice(0, i);
}
