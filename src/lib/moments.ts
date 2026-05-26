import sql from "./db";

export type MomentRow = {
  id: number;
  summary: string;
  source_type: string; // 'commit' | 'note' | 'mixed' (constrained by Claude, not the DB)
  source_ref: unknown; // jsonb — typically string[] | null; Claude guarantees the shape
  generation_id: string;
  created_at: Date;
  repo: string | null;
};

export type DraftRow = {
  id: number;
  moment_id: number;
  variant: "x_thread" | "ih_long";
  content: string;
  status: "draft" | "approved" | "posted" | "rejected";
  rating: "star" | "flop" | "neutral" | null;
  posted_url: string | null;
  posted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type MomentWithDrafts = MomentRow & {
  source_refs: string[];
  drafts: DraftRow[];
};

/**
 * Insert a moment along with its two draft variants. Uses the Postgres RPC
 * function `insert_moment_with_drafts` (defined in migration 0002) to wrap
 * the multi-row insert in a real ACID transaction — what we used to get from
 * db.transaction() under node:sqlite.
 *
 * Returns the new moment's id.
 */
export async function insertMomentWithDrafts(args: {
  summary: string;
  sourceType: string;
  sourceRefs: string[];
  generationId: string;
  xThread: string;
  ihLong: string;
  repo: string | null;
}): Promise<number> {
  const result = await sql<Array<{ id: number | null }>>`
    SELECT insert_moment_with_drafts(
      ${args.summary},
      ${args.sourceType},
      ${JSON.stringify(args.sourceRefs)}::jsonb,
      ${args.generationId},
      ${args.repo},
      ${args.xThread},
      ${args.ihLong}
    ) AS id
  `;
  const id = result[0]?.id;
  if (id === null || id === undefined) {
    throw new Error("insertMomentWithDrafts: RPC returned no id");
  }
  return Number(id);
}

/** All moments in the most recent generation, with their drafts attached. */
export async function getLatestGeneration(): Promise<MomentWithDrafts[]> {
  // Step 1: find the most recent generation_id.
  const latest = await sql<Array<{ generation_id: string }>>`
    SELECT generation_id
    FROM moments
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
  if (latest.length === 0) return [];
  return getMomentsByGeneration(latest[0].generation_id);
}

/**
 * Fetch all moments with a given generation_id, plus their drafts as nested
 * objects. We do this as two queries (moments, then drafts for those moment
 * ids) and stitch in JS — keeps the typing simple and avoids JSON aggregation.
 */
export async function getMomentsByGeneration(
  generationId: string,
): Promise<MomentWithDrafts[]> {
  const moments = await sql<MomentRow[]>`
    SELECT id, summary, source_type, source_ref, generation_id, created_at, repo
    FROM moments
    WHERE generation_id = ${generationId}
    ORDER BY id ASC
  `;
  if (moments.length === 0) return [];

  const momentIds = moments.map((m) => m.id);
  const drafts = await sql<DraftRow[]>`
    SELECT id, moment_id, variant, content, status, rating,
           posted_url, posted_at, created_at, updated_at
    FROM drafts
    WHERE moment_id IN ${sql(momentIds)}
  `;

  // Group drafts by moment_id.
  const byMoment = new Map<number, DraftRow[]>();
  for (const d of drafts) {
    const arr = byMoment.get(d.moment_id) ?? [];
    arr.push(d);
    byMoment.set(d.moment_id, arr);
  }

  return moments.map((m) => {
    let sourceRefs: string[] = [];
    if (Array.isArray(m.source_ref)) {
      sourceRefs = m.source_ref.filter(
        (s): s is string => typeof s === "string",
      );
    }
    // Sort drafts deterministically so the X / IH tabs always render in the
    // same order. ih_long < x_thread alphabetically.
    const sortedDrafts = (byMoment.get(m.id) ?? []).sort((a, b) =>
      a.variant.localeCompare(b.variant),
    );
    return {
      ...m,
      source_refs: sourceRefs,
      drafts: sortedDrafts,
    };
  });
}
