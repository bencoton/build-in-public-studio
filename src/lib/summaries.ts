// Per-project product summaries. Two-kind schema (see migration 0003):
//   - kind = 'website'   — content is JSON: { tagline, intro, features[] }
//   - kind = 'launch_x'  — content is plain text (X thread, numbered tweets)
//   - kind = 'launch_ih' — content is plain text (Indie Hackers long-form)
//
// Multiple rows per (repo, kind) are allowed. The UI defaults to showing the
// most recent row per kind; regenerate inserts a new row rather than
// overwriting, so prior versions are preserved.

import sql from "./db";

export type SummaryKind = "website" | "launch_x" | "launch_ih";
export type SummaryStatus = "draft" | "approved" | "posted" | "rejected";

export type SummaryRow = {
  id: number;
  repo: string;
  kind: SummaryKind;
  /** Plain text for launch_*; JSON-encoded structure for website. */
  content: string;
  status: SummaryStatus;
  rating: "star" | "flop" | "neutral" | null;
  posted_url: string | null;
  posted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type WebsiteSummaryContent = {
  tagline: string;
  intro: string;
  features: string[];
};

/** The most recent summary of each kind for a given project. Returns up to
 *  three rows: website, launch_x, launch_ih. Missing kinds are simply absent
 *  from the result. */
export async function getLatestSummariesForRepo(
  repo: string,
): Promise<SummaryRow[]> {
  const rows = await sql<SummaryRow[]>`
    SELECT DISTINCT ON (kind)
           id, repo, kind, content, status, rating,
           posted_url, posted_at, created_at, updated_at
    FROM summaries
    WHERE repo = ${repo}
    ORDER BY kind, created_at DESC, id DESC
  `;
  return rows.map((r) => ({ ...r }));
}

/** Insert a single summary row. Used by website-summary generation. */
export async function insertSummary(args: {
  repo: string;
  kind: SummaryKind;
  content: string;
}): Promise<number> {
  const rows = await sql<Array<{ id: number }>>`
    INSERT INTO summaries (repo, kind, content)
    VALUES (${args.repo}, ${args.kind}, ${args.content})
    RETURNING id
  `;
  const id = rows[0]?.id;
  if (id === null || id === undefined) {
    throw new Error("insertSummary: no id returned");
  }
  return Number(id);
}

/** Insert both halves of a launch announcement atomically. Returns the
 *  two new ids. */
export async function insertLaunchSummary(args: {
  repo: string;
  xThread: string;
  ihLong: string;
}): Promise<{ xId: number; ihId: number }> {
  const rows = await sql<Array<{ id: number; kind: SummaryKind }>>`
    INSERT INTO summaries (repo, kind, content)
    VALUES
      (${args.repo}, 'launch_x', ${args.xThread}),
      (${args.repo}, 'launch_ih', ${args.ihLong})
    RETURNING id, kind
  `;
  const xId = rows.find((r) => r.kind === "launch_x")?.id;
  const ihId = rows.find((r) => r.kind === "launch_ih")?.id;
  if (xId === undefined || ihId === undefined) {
    throw new Error("insertLaunchSummary: expected two rows back");
  }
  return { xId: Number(xId), ihId: Number(ihId) };
}

/** Replace a summary's content (after inline edit). Bumps updated_at. */
export async function updateSummaryContent(
  summaryId: number,
  content: string,
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Summary content cannot be empty.");
  }
  await sql`
    UPDATE summaries
    SET content = ${trimmed}, updated_at = now()
    WHERE id = ${summaryId}
  `;
}

/** Mark a summary as posted with a URL. */
export async function markSummaryAsPosted(
  summaryId: number,
  postedUrl: string,
): Promise<void> {
  await sql`
    UPDATE summaries
    SET status = 'posted',
        posted_url = ${postedUrl},
        posted_at = now(),
        updated_at = now()
    WHERE id = ${summaryId}
  `;
}

/** Parse the website JSON safely. Returns a fallback shape if parsing fails
 *  so the UI never crashes on a malformed row. */
export function parseWebsiteContent(content: string): WebsiteSummaryContent {
  try {
    const parsed = JSON.parse(content);
    return {
      tagline: typeof parsed.tagline === "string" ? parsed.tagline : "",
      intro: typeof parsed.intro === "string" ? parsed.intro : "",
      features: Array.isArray(parsed.features)
        ? parsed.features.filter((f: unknown): f is string => typeof f === "string")
        : [],
    };
  } catch {
    return { tagline: "", intro: "", features: [] };
  }
}
