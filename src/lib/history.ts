import { supabase } from "./supabase";
import type { DraftRow } from "./moments";
import type { DraftStatus } from "./draft-mutations";

export type DraftRating = "star" | "flop" | "neutral";

export type HistoryDraft = DraftRow & {
  moment_summary: string;
  moment_source_type: string;
  moment_created_at: string;
  moment_repo: string | null;
};

export type HistoryFilters = {
  status?: DraftStatus | "all";
  variant?: "x_thread" | "ih_long" | "all";
  rating?: DraftRating | "unrated" | "all";
  /** "owner/name", "general" for NULL-repo moments, or "all" / undefined for no filter. */
  repo?: string;
};

// ── Shared shape for nested-select rows returned from PostgREST ───────────
// Supabase's FK-join select returns `moments` as a nested object on each draft
// row. The TypeScript types from `src/types/database.ts` know about the join,
// but to keep the mapping in one place we declare our own narrow type and
// cast.
type DraftWithMomentRow = DraftRow & {
  moments: {
    summary: string;
    source_type: string;
    created_at: string;
    repo: string | null;
  } | null;
};

function flatten(row: DraftWithMomentRow): HistoryDraft {
  return {
    id: row.id,
    moment_id: row.moment_id,
    variant: row.variant,
    content: row.content,
    status: row.status,
    rating: row.rating,
    posted_url: row.posted_url,
    posted_at: row.posted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    moment_summary: row.moments?.summary ?? "",
    moment_source_type: row.moments?.source_type ?? "",
    moment_created_at: row.moments?.created_at ?? "",
    moment_repo: row.moments?.repo ?? null,
  };
}

/**
 * Fetch every draft across all generations, optionally filtered. Newest-first.
 *
 * Uses an INNER FK join (`moments!inner(...)`) so we can filter on
 * `moments.repo` — PostgREST requires an explicit inner-join to apply
 * filters on embedded resources.
 */
export async function getAllDrafts(
  filters: HistoryFilters = {},
): Promise<HistoryDraft[]> {
  let query = supabase
    .from("drafts")
    .select(
      `id, moment_id, variant, content, status, rating,
       posted_url, posted_at, created_at, updated_at,
       moments!inner (
         summary, source_type, created_at, repo
       )`,
    )
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.variant && filters.variant !== "all") {
    query = query.eq("variant", filters.variant);
  }
  if (filters.rating) {
    if (filters.rating === "unrated") {
      query = query.is("rating", null);
    } else if (filters.rating !== "all") {
      query = query.eq("rating", filters.rating);
    }
  }
  if (filters.repo && filters.repo !== "all") {
    if (filters.repo === "general") {
      query = query.is("moments.repo", null);
    } else {
      query = query.eq("moments.repo", filters.repo);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`getAllDrafts: ${error.message}`);
  return (data ?? []).map((row) => flatten(row as unknown as DraftWithMomentRow));
}

/** Set or clear a draft's rating. Pass null to clear. */
export async function setDraftRating(
  draftId: number,
  rating: DraftRating | null,
): Promise<void> {
  const { error } = await supabase
    .from("drafts")
    .update({ rating, updated_at: new Date().toISOString() })
    .eq("id", draftId);
  if (error) throw new Error(`setDraftRating(${draftId}): ${error.message}`);
}

/**
 * Pull up to `count` starred drafts as voice examples for the Claude prompt.
 * Posted-and-starred entries are preferred over just-starred — the former
 * is a stronger signal that the voice actually worked publicly.
 *
 * Postgres doesn't have a `RANDOM()` modifier in PostgREST queries, so we
 * fetch ALL starred drafts and sample client-side. At single-user scale
 * (likely <100 starred drafts in a year) this is trivial.
 */
export async function getStarredExamples(count: number): Promise<HistoryDraft[]> {
  const safe = Math.min(Math.max(1, Math.floor(count)), 50);

  const { data, error } = await supabase
    .from("drafts")
    .select(
      `id, moment_id, variant, content, status, rating,
       posted_url, posted_at, created_at, updated_at,
       moments!inner (
         summary, source_type, created_at, repo
       )`,
    )
    .eq("rating", "star");
  if (error) throw new Error(`getStarredExamples: ${error.message}`);

  const all = (data ?? []).map((row) =>
    flatten(row as unknown as DraftWithMomentRow),
  );

  // Posted-and-starred float to the top within the random sample, mirroring
  // the original `ORDER BY (status='posted') DESC, RANDOM()` SQL semantics.
  const posted = all.filter((d) => d.status === "posted");
  const others = all.filter((d) => d.status !== "posted");
  shuffleInPlace(posted);
  shuffleInPlace(others);
  return [...posted, ...others].slice(0, safe);
}

/** Count drafts grouped by status — used by the history page header. */
export async function getDraftCountsByStatus(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("drafts").select("status");
  if (error) throw new Error(`getDraftCountsByStatus: ${error.message}`);

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    result[row.status] = (result[row.status] ?? 0) + 1;
  }
  return result;
}

/**
 * Distinct repos that appear on at least one moment in the DB. Used to
 * populate the History page's project-filter dropdown. Sorted alphabetically.
 * Does NOT include "general" — the page handles that as a separate option.
 */
export async function getProjectsInHistory(): Promise<string[]> {
  const { data, error } = await supabase
    .from("moments")
    .select("repo")
    .not("repo", "is", null);
  if (error) throw new Error(`getProjectsInHistory: ${error.message}`);

  const unique = new Set<string>();
  for (const row of data ?? []) {
    if (typeof row.repo === "string" && row.repo.length > 0) {
      unique.add(row.repo);
    }
  }
  return Array.from(unique).sort();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
