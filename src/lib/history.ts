import sql from "./db";
import type { DraftRow } from "./moments";
import type { DraftStatus } from "./draft-mutations";

export type DraftRating = "star" | "flop" | "neutral";

export type HistoryDraft = DraftRow & {
  moment_summary: string;
  moment_source_type: string;
  moment_created_at: Date;
  moment_repo: string | null;
};

export type HistoryFilters = {
  status?: DraftStatus | "all";
  variant?: "x_thread" | "ih_long" | "reddit" | "all";
  rating?: DraftRating | "unrated" | "all";
  /** "owner/name", "general" for NULL-repo moments, or "all" / undefined for no filter. */
  repo?: string;
};

/**
 * Fetch every draft across all generations, optionally filtered. Newest-first.
 *
 * Joins drafts → moments so we can filter on the moment's `repo` and surface
 * the moment summary in the same row.
 */
export async function getAllDrafts(
  filters: HistoryFilters = {},
): Promise<HistoryDraft[]> {
  const status =
    filters.status && filters.status !== "all" ? filters.status : null;
  const variant =
    filters.variant && filters.variant !== "all" ? filters.variant : null;
  const ratingFilter = filters.rating ?? null;
  const repoFilter =
    filters.repo && filters.repo !== "all" ? filters.repo : null;

  const rows = await sql<
    Array<{
      id: number;
      moment_id: number;
      variant: DraftRow["variant"];
      content: string;
      subreddit: string | null;
      title: string | null;
      status: DraftRow["status"];
      rating: DraftRow["rating"];
      posted_url: string | null;
      posted_at: Date | null;
      scheduled_for: Date | null;
      created_at: Date;
      updated_at: Date;
      moment_summary: string;
      moment_source_type: string;
      moment_created_at: Date;
      moment_repo: string | null;
    }>
  >`
    SELECT
      d.id, d.moment_id, d.variant, d.content, d.subreddit, d.title, d.status, d.rating,
      d.posted_url, d.posted_at, d.scheduled_for, d.created_at, d.updated_at,
      m.summary      AS moment_summary,
      m.source_type  AS moment_source_type,
      m.created_at   AS moment_created_at,
      m.repo         AS moment_repo
    FROM drafts d
    INNER JOIN moments m ON m.id = d.moment_id
    WHERE
      (${status}::text IS NULL OR d.status = ${status})
      AND (${variant}::text IS NULL OR d.variant = ${variant})
      AND (
        ${ratingFilter}::text IS NULL
        OR ${ratingFilter}::text = 'all'
        OR (${ratingFilter}::text = 'unrated' AND d.rating IS NULL)
        OR (${ratingFilter}::text NOT IN ('all', 'unrated') AND d.rating = ${ratingFilter})
      )
      AND (
        ${repoFilter}::text IS NULL
        OR (${repoFilter}::text = 'general' AND m.repo IS NULL)
        OR (${repoFilter}::text <> 'general' AND m.repo = ${repoFilter})
      )
    ORDER BY d.updated_at DESC, d.id DESC
    LIMIT 500
  `;

  return rows.map((r) => ({ ...r }));
}

/** Set or clear a draft's rating. Pass null to clear. */
export async function setDraftRating(
  draftId: number,
  rating: DraftRating | null,
): Promise<void> {
  try {
    await sql`
      UPDATE drafts
      SET rating = ${rating}, updated_at = now()
      WHERE id = ${draftId}
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`setDraftRating(${draftId}): ${msg}`);
  }
}

/**
 * Pull up to `count` starred drafts as voice examples for the Claude prompt.
 * Posted-and-starred entries are preferred over just-starred — the former
 * is a stronger signal that the voice actually worked publicly.
 *
 * Postgres has no portable RANDOM()-with-limit-by-condition idiom we want to
 * lean on, so we fetch ALL starred drafts and sample client-side. At
 * single-user scale (likely <100 starred drafts in a year) this is trivial.
 */
export async function getStarredExamples(
  count: number,
  variant?: DraftRow["variant"],
): Promise<HistoryDraft[]> {
  const safe = Math.min(Math.max(1, Math.floor(count)), 50);
  const variantFilter = variant ?? null;

  const rows = await sql<
    Array<{
      id: number;
      moment_id: number;
      variant: DraftRow["variant"];
      content: string;
      subreddit: string | null;
      title: string | null;
      status: DraftRow["status"];
      rating: DraftRow["rating"];
      posted_url: string | null;
      posted_at: Date | null;
      scheduled_for: Date | null;
      created_at: Date;
      updated_at: Date;
      moment_summary: string;
      moment_source_type: string;
      moment_created_at: Date;
      moment_repo: string | null;
    }>
  >`
    SELECT
      d.id, d.moment_id, d.variant, d.content, d.subreddit, d.title, d.status, d.rating,
      d.posted_url, d.posted_at, d.scheduled_for, d.created_at, d.updated_at,
      m.summary      AS moment_summary,
      m.source_type  AS moment_source_type,
      m.created_at   AS moment_created_at,
      m.repo         AS moment_repo
    FROM drafts d
    INNER JOIN moments m ON m.id = d.moment_id
    WHERE d.rating = 'star'
      AND (${variantFilter}::text IS NULL OR d.variant = ${variantFilter})
  `;

  const all: HistoryDraft[] = rows.map((r) => ({ ...r }));

  // Posted-and-starred float to the top within the random sample, mirroring
  // the original `ORDER BY (status='posted') DESC, RANDOM()` SQL semantics.
  const posted = all.filter((d) => d.status === "posted");
  const others = all.filter((d) => d.status !== "posted");
  shuffleInPlace(posted);
  shuffleInPlace(others);
  return [...posted, ...others].slice(0, safe);
}

/**
 * Drafts scheduled to post within the next `daysAhead` days. Used by the
 * dashboard's "Scheduled for the next 7 days" section to surface batch-
 * generated content as it comes due. Joined to moments so we get the project
 * label and summary alongside.
 */
export async function getScheduledDrafts(
  daysAhead: number = 7,
): Promise<HistoryDraft[]> {
  const days = Math.min(Math.max(1, Math.floor(daysAhead)), 60);

  const rows = await sql<
    Array<{
      id: number;
      moment_id: number;
      variant: DraftRow["variant"];
      content: string;
      subreddit: string | null;
      title: string | null;
      status: DraftRow["status"];
      rating: DraftRow["rating"];
      posted_url: string | null;
      posted_at: Date | null;
      scheduled_for: Date | null;
      created_at: Date;
      updated_at: Date;
      moment_summary: string;
      moment_source_type: string;
      moment_created_at: Date;
      moment_repo: string | null;
    }>
  >`
    SELECT
      d.id, d.moment_id, d.variant, d.content, d.subreddit, d.title, d.status, d.rating,
      d.posted_url, d.posted_at, d.scheduled_for, d.created_at, d.updated_at,
      m.summary      AS moment_summary,
      m.source_type  AS moment_source_type,
      m.created_at   AS moment_created_at,
      m.repo         AS moment_repo
    FROM drafts d
    INNER JOIN moments m ON m.id = d.moment_id
    WHERE d.scheduled_for IS NOT NULL
      AND d.scheduled_for >= now() - interval '1 day'
      AND d.scheduled_for <= now() + (${days} * interval '1 day')
      AND d.status IN ('draft', 'approved')
    ORDER BY d.scheduled_for ASC, d.id ASC
    LIMIT 100
  `;

  return rows.map((r) => ({ ...r }));
}

/** Count drafts grouped by status — used by the history page header. */
export async function getDraftCountsByStatus(): Promise<Record<string, number>> {
  const rows = await sql<Array<{ status: string; count: number }>>`
    SELECT status, COUNT(*)::int AS count
    FROM drafts
    GROUP BY status
  `;
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = row.count;
  }
  return result;
}

/**
 * Distinct repos that appear on at least one moment in the DB. Used to
 * populate the History page's project-filter dropdown. Sorted alphabetically.
 * Does NOT include "general" — the page handles that as a separate option.
 */
export async function getProjectsInHistory(): Promise<string[]> {
  const rows = await sql<Array<{ repo: string }>>`
    SELECT DISTINCT repo
    FROM moments
    WHERE repo IS NOT NULL
    ORDER BY repo ASC
  `;
  return rows.map((r) => r.repo);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
