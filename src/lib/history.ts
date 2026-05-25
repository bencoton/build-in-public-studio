import { db } from "./db";
import type { DraftRow } from "./moments";
import type { DraftStatus } from "./draft-mutations";

export type DraftRating = "star" | "flop" | "neutral";

export type HistoryDraft = DraftRow & {
  moment_summary: string;
  moment_source_type: string;
  moment_created_at: string;
};

export type HistoryFilters = {
  status?: DraftStatus | "all";
  variant?: "x_thread" | "ih_long" | "all";
  rating?: DraftRating | "unrated" | "all";
};

/**
 * Fetch every draft across all generations, joined to its moment, optionally
 * filtered by status / variant / rating. Newest-first.
 *
 * Spread each row into a plain object before returning so callers passing
 * results to Client Components don't trip BIPS-L4.
 */
export function getAllDrafts(filters: HistoryFilters = {}): HistoryDraft[] {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.status && filters.status !== "all") {
    where.push("d.status = ?");
    params.push(filters.status);
  }
  if (filters.variant && filters.variant !== "all") {
    where.push("d.variant = ?");
    params.push(filters.variant);
  }
  if (filters.rating) {
    if (filters.rating === "unrated") {
      where.push("d.rating IS NULL");
    } else if (filters.rating !== "all") {
      where.push("d.rating = ?");
      params.push(filters.rating);
    }
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      d.id, d.moment_id, d.variant, d.content, d.status, d.rating,
      d.posted_url, d.posted_at, d.created_at, d.updated_at,
      m.summary AS moment_summary,
      m.source_type AS moment_source_type,
      m.created_at AS moment_created_at
    FROM drafts d
    JOIN moments m ON m.id = d.moment_id
    ${whereClause}
    ORDER BY d.updated_at DESC, d.id DESC
    LIMIT 500
  `;

  const rows = db.prepare(sql).all(...params) as HistoryDraft[];
  // Spread each row to a plain {} so the page can pass them as props to the
  // client RatingButtons component (per BIPS-L4).
  return rows.map((r) => ({ ...r }));
}

/** Set or clear a draft's rating. Pass null to clear. */
export function setDraftRating(
  draftId: number,
  rating: DraftRating | null,
): void {
  db.prepare(
    `UPDATE drafts SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(rating, draftId);
}

/**
 * Pull up to `count` random starred drafts to feed into Claude as voice
 * examples. Posted drafts are preferred (they're the ones that actually
 * went out) but any starred draft qualifies.
 */
export function getStarredExamples(count: number): HistoryDraft[] {
  const safe = Math.min(Math.max(1, Math.floor(count)), 50);
  // ORDER BY (status='posted') DESC puts posted entries first within the
  // RANDOM() sample. Subtle but right — a starred posted draft is a stronger
  // signal than a starred draft that never shipped.
  const rows = db
    .prepare(
      `SELECT
         d.id, d.moment_id, d.variant, d.content, d.status, d.rating,
         d.posted_url, d.posted_at, d.created_at, d.updated_at,
         m.summary AS moment_summary,
         m.source_type AS moment_source_type,
         m.created_at AS moment_created_at
       FROM drafts d
       JOIN moments m ON m.id = d.moment_id
       WHERE d.rating = 'star'
       ORDER BY (d.status = 'posted') DESC, RANDOM()
       LIMIT ?`,
    )
    .all(safe) as HistoryDraft[];
  return rows.map((r) => ({ ...r }));
}

/** Count drafts grouped by status — used by the page header. */
export function getDraftCountsByStatus(): Record<string, number> {
  const rows = db
    .prepare(`SELECT status, COUNT(*) AS count FROM drafts GROUP BY status`)
    .all() as Array<{ status: string; count: number }>;
  const result: Record<string, number> = {};
  for (const r of rows) result[r.status] = r.count;
  return result;
}
