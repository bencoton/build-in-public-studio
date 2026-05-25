import { db, transaction } from "./db";

export type MomentRow = {
  id: number;
  summary: string;
  source_type: string; // 'commit' | 'note' | 'mixed' (constrained by Claude, not the DB)
  source_ref: string | null; // JSON array of strings
  generation_id: string;
  created_at: string;
};

export type DraftRow = {
  id: number;
  moment_id: number;
  variant: "x_thread" | "ih_long";
  content: string;
  status: "draft" | "approved" | "posted" | "rejected";
  rating: "star" | "flop" | "neutral" | null;
  posted_url: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MomentWithDrafts = MomentRow & {
  source_refs: string[];
  drafts: DraftRow[];
};

/**
 * Insert a moment along with its two draft variants. Returns the new moment_id.
 * Wrapped in a transaction so a partial failure doesn't leave a half-saved moment.
 */
export function insertMomentWithDrafts(args: {
  summary: string;
  sourceType: string;
  sourceRefs: string[];
  generationId: string;
  xThread: string;
  ihLong: string;
}): number {
  return transaction(() => {
    const momentResult = db
      .prepare(
        `INSERT INTO moments (summary, source_type, source_ref, generation_id)
           VALUES (?, ?, ?, ?)`,
      )
      .run(
        args.summary,
        args.sourceType,
        JSON.stringify(args.sourceRefs),
        args.generationId,
      ) as { lastInsertRowid: number | bigint };
    const momentId = Number(momentResult.lastInsertRowid);

    const insertDraft = db.prepare(
      `INSERT INTO drafts (moment_id, variant, content) VALUES (?, ?, ?)`,
    );
    insertDraft.run(momentId, "x_thread", args.xThread);
    insertDraft.run(momentId, "ih_long", args.ihLong);

    return momentId;
  });
}

/** Latest generation's moments + their drafts. */
export function getLatestGeneration(): MomentWithDrafts[] {
  const latest = db
    .prepare(
      "SELECT generation_id FROM moments ORDER BY created_at DESC, id DESC LIMIT 1",
    )
    .get() as { generation_id: string } | undefined;
  if (!latest) return [];
  return getMomentsByGeneration(latest.generation_id);
}

export function getMomentsByGeneration(generationId: string): MomentWithDrafts[] {
  const moments = db
    .prepare(
      `SELECT id, summary, source_type, source_ref, generation_id, created_at
         FROM moments
         WHERE generation_id = ?
         ORDER BY id ASC`,
    )
    .all(generationId) as MomentRow[];

  if (moments.length === 0) return [];

  const draftsStmt = db.prepare(
    `SELECT id, moment_id, variant, content, status, rating, posted_url, posted_at, created_at, updated_at
       FROM drafts
       WHERE moment_id = ?
       ORDER BY variant ASC`,
  );

  return moments.map((m) => {
    const drafts = draftsStmt.all(m.id) as DraftRow[];
    let sourceRefs: string[] = [];
    if (m.source_ref) {
      try {
        const parsed = JSON.parse(m.source_ref);
        if (Array.isArray(parsed)) {
          sourceRefs = parsed.filter((s): s is string => typeof s === "string");
        }
      } catch {
        // Malformed source_ref — fall back to empty.
      }
    }
    // node:sqlite returns null-prototype objects from .all() / .get(). Spreading
    // each one into a fresh {} gives it a plain prototype, which is required
    // for the Server → Client component prop boundary (see BIPS-L4 in
    // CLAUDE.md). The outer `{...m, ...}` covers the moment itself; mapping
    // over drafts handles each row in the array.
    return {
      ...m,
      source_refs: sourceRefs,
      drafts: drafts.map((d) => ({ ...d })),
    };
  });
}
