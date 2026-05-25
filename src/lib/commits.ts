import { supabase } from "./supabase";

export type CommitRow = {
  id: number;
  repo: string;
  sha: string;
  message: string;
  files_changed: number | null;
  committed_at: string;
  synced_at: string;
};

/**
 * Insert a commit, or do nothing if (repo, sha) already exists.
 * Returns true if a NEW row was inserted, false if the (repo, sha) pair was
 * already in the table.
 *
 * Implementation note: Supabase's upsert with `ignoreDuplicates: true` returns
 * inserted rows in the `.select()` payload — duplicates are silently skipped.
 * Counting the returned rows tells us whether anything actually changed.
 */
export async function upsertCommit(
  repo: string,
  sha: string,
  message: string,
  committedAt: string,
  filesChanged: number | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("commits")
    .upsert(
      {
        repo,
        sha,
        message,
        committed_at: committedAt,
        files_changed: filesChanged,
      },
      { onConflict: "repo,sha", ignoreDuplicates: true },
    )
    .select("id");

  if (error) throw new Error(`upsertCommit(${repo}, ${sha}): ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Most recent N commits across all repos, newest first. */
export async function getRecentCommits(limit = 200): Promise<CommitRow[]> {
  const safe = Math.min(Math.max(1, Math.floor(limit)), 1000);

  const { data, error } = await supabase
    .from("commits")
    .select("id, repo, sha, message, files_changed, committed_at, synced_at")
    .order("committed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safe);

  if (error) throw new Error(`getRecentCommits: ${error.message}`);
  return data ?? [];
}

/** Most recent sync timestamp (max of synced_at), or null if no commits cached. */
export async function getLastSyncedAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from("commits")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getLastSyncedAt: ${error.message}`);
  return data?.synced_at ?? null;
}

/**
 * Per-repo commit counts. Client-side grouping rather than a Postgres
 * GROUP BY — at single-user scale (max a few hundred commits cached)
 * the data transfer is trivial. Avoids needing a Postgres view or RPC.
 */
export async function getCommitCountsByRepo(): Promise<
  Array<{ repo: string; count: number }>
> {
  const { data, error } = await supabase.from("commits").select("repo");
  if (error) throw new Error(`getCommitCountsByRepo: ${error.message}`);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.repo, (map.get(row.repo) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => a.repo.localeCompare(b.repo));
}

/**
 * Used by claude.ts's deriveMomentRepo: given a SHA prefix, return the
 * distinct repos that have any matching commit. Most callers will see a
 * single-element array (commits aren't usually shared across repos).
 */
export async function getReposForShaPrefix(prefix: string): Promise<string[]> {
  // Postgres LIKE is case-sensitive. GitHub returns lowercase SHAs so we
  // normalise the prefix to lowercase before matching.
  const lower = prefix.toLowerCase();
  const { data, error } = await supabase
    .from("commits")
    .select("repo")
    .like("sha", `${lower}%`);

  if (error) throw new Error(`getReposForShaPrefix(${prefix}): ${error.message}`);
  // Dedupe client-side — supabase-js doesn't expose a DISTINCT modifier.
  return Array.from(new Set((data ?? []).map((r) => r.repo)));
}
