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

export type DraftVariant = "x_thread" | "ih_long" | "reddit";

export type DraftRow = {
  id: number;
  moment_id: number;
  variant: DraftVariant;
  content: string;
  /** Reddit-only: target sub slug (a slug from the user-managed subreddits
   *  catalog). NULL for x_thread / ih_long (enforced by a DB CHECK constraint). */
  subreddit: string | null;
  /** Reddit-only: post title, stored separately from the self-text `content`.
   *  NULL for x_thread / ih_long. */
  title: string | null;
  status: "draft" | "approved" | "posted" | "rejected";
  rating: "star" | "flop" | "neutral" | null;
  posted_url: string | null;
  posted_at: Date | null;
  /** When the draft is meant to be posted. NULL = not scheduled (the weekly
   *  cron path); populated by the batch-generation flow with auto-staggered
   *  Mon/Thu dates that the user can edit per-draft. */
  scheduled_for: Date | null;
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
  /** Optional: when set, both new drafts get this scheduled_for date.
   *  Used by the batch-generation flow; the weekly cron leaves this NULL
   *  (its drafts are for immediate review, not pre-scheduled posting). */
  scheduledFor?: Date | null;
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
  const momentId = Number(id);

  // If a scheduled date was supplied, stamp both variants. Separate UPDATE
  // rather than extending the RPC — keeps the RPC stable and avoids another
  // migration round-trip for what's a single-purpose feature.
  if (args.scheduledFor) {
    await sql`
      UPDATE drafts
      SET scheduled_for = ${args.scheduledFor}, updated_at = now()
      WHERE moment_id = ${momentId}
    `;
  }

  return momentId;
}

/**
 * Insert a single Reddit draft attached to an existing moment. Unlike X/IH
 * (created together with the moment via the insert_moment_with_drafts RPC),
 * Reddit drafts are generated on demand from the dashboard, one row per
 * (moment × sub). variant is fixed to 'reddit'; subreddit + title are required
 * by the DB CHECK constraints added in migration 0004 Part A.
 *
 * Returns the new draft's id.
 */
export async function insertRedditDraft(args: {
  momentId: number;
  subreddit: string;
  title: string;
  content: string;
}): Promise<number> {
  const rows = await sql<Array<{ id: number }>>`
    INSERT INTO drafts (moment_id, variant, subreddit, title, content)
    VALUES (${args.momentId}, 'reddit', ${args.subreddit}, ${args.title}, ${args.content})
    RETURNING id
  `;
  const id = rows[0]?.id;
  if (id === undefined || id === null) {
    throw new Error("insertRedditDraft: insert returned no id");
  }
  return Number(id);
}

/**
 * Delete any existing Reddit drafts for a (moment × sub) before regenerating,
 * so a re-run replaces rather than stacks duplicates. Only removes rows still
 * in 'draft' status — never clobbers an approved/posted Reddit draft.
 */
export async function deleteRedditDraftsForSub(
  momentId: number,
  subreddit: string,
): Promise<void> {
  await sql`
    DELETE FROM drafts
    WHERE moment_id = ${momentId}
      AND variant = 'reddit'
      AND subreddit = ${subreddit}
      AND status = 'draft'
  `;
}

/** Fetch one moment by id (without drafts). Used by the Reddit generate action. */
export async function getMomentById(
  momentId: number,
): Promise<MomentWithDrafts | null> {
  const moments = await sql<MomentRow[]>`
    SELECT id, summary, source_type, source_ref, generation_id, created_at, repo
    FROM moments
    WHERE id = ${momentId}
    LIMIT 1
  `;
  const m = moments[0];
  if (!m) return null;

  let sourceRefs: string[] = [];
  if (Array.isArray(m.source_ref)) {
    sourceRefs = m.source_ref.filter((s): s is string => typeof s === "string");
  }
  return { ...m, source_refs: sourceRefs, drafts: [] };
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
    SELECT id, moment_id, variant, content, subreddit, title, status, rating,
           posted_url, posted_at, scheduled_for, created_at, updated_at
    FROM drafts
    WHERE moment_id IN ${sql(momentIds)}
  `;

  // Group drafts by moment_id. Spread each row into a plain object (BIPS-L4):
  // these cross into the MomentCard client component.
  const byMoment = new Map<number, DraftRow[]>();
  for (const d of drafts) {
    const arr = byMoment.get(d.moment_id) ?? [];
    arr.push({ ...d });
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
