import { supabase } from "./supabase";

export type MomentRow = {
  id: number;
  summary: string;
  source_type: string; // 'commit' | 'note' | 'mixed' (constrained by Claude, not the DB)
  source_ref: unknown; // jsonb — typically string[] | null; Claude guarantees the shape
  generation_id: string;
  created_at: string;
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
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MomentWithDrafts = MomentRow & {
  source_refs: string[];
  drafts: DraftRow[];
};

/**
 * Insert a moment along with its two draft variants. Uses the Postgres RPC
 * function `insert_moment_with_drafts` (defined in migration 20260525180000)
 * to wrap the multi-row insert in a real ACID transaction — what we used to
 * get from db.transaction() under node:sqlite.
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
  const { data, error } = await supabase.rpc("insert_moment_with_drafts", {
    p_summary: args.summary,
    p_source_type: args.sourceType,
    p_source_refs: args.sourceRefs,
    p_generation_id: args.generationId,
    p_repo: args.repo,
    p_x_thread: args.xThread,
    p_ih_long: args.ihLong,
  });
  if (error) throw new Error(`insertMomentWithDrafts: ${error.message}`);
  if (data === null || data === undefined) {
    throw new Error("insertMomentWithDrafts: RPC returned no id");
  }
  // bigint from Postgres may come through as number or string depending on
  // the client version. Normalise via Number().
  return Number(data);
}

/** All moments in the most recent generation, with their drafts attached. */
export async function getLatestGeneration(): Promise<MomentWithDrafts[]> {
  // Step 1: find the most recent generation_id.
  const { data: latest, error: e1 } = await supabase
    .from("moments")
    .select("generation_id")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw new Error(`getLatestGeneration (find latest): ${e1.message}`);
  if (!latest) return [];

  return getMomentsByGeneration(latest.generation_id);
}

/**
 * Fetch all moments with a given generation_id, plus their drafts as nested
 * objects (via PostgREST's FK-join select syntax). Each moment row comes back
 * with a `drafts` array embedded.
 */
export async function getMomentsByGeneration(
  generationId: string,
): Promise<MomentWithDrafts[]> {
  const { data, error } = await supabase
    .from("moments")
    .select(
      `id, summary, source_type, source_ref, generation_id, created_at, repo,
       drafts (
         id, moment_id, variant, content, status, rating,
         posted_url, posted_at, created_at, updated_at
       )`,
    )
    .eq("generation_id", generationId)
    .order("id", { ascending: true });

  if (error) throw new Error(`getMomentsByGeneration: ${error.message}`);

  return (data ?? []).map((m) => {
    // source_ref is jsonb — Supabase parses it for us, so no JSON.parse needed
    // (unlike under node:sqlite where it came back as a string).
    let sourceRefs: string[] = [];
    if (Array.isArray(m.source_ref)) {
      sourceRefs = m.source_ref.filter(
        (s): s is string => typeof s === "string",
      );
    }
    // Sort drafts deterministically so the X / IH tabs always render in the
    // same order. ih_long < x_thread alphabetically — matches the SQLite ORDER BY.
    const sortedDrafts = (m.drafts ?? []).sort((a, b) =>
      a.variant.localeCompare(b.variant),
    );
    return {
      id: m.id,
      summary: m.summary,
      source_type: m.source_type,
      source_ref: m.source_ref,
      generation_id: m.generation_id,
      created_at: m.created_at,
      repo: m.repo,
      source_refs: sourceRefs,
      drafts: sortedDrafts as DraftRow[],
    };
  });
}
