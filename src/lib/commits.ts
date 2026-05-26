import sql from "./db";

export type CommitRow = {
  id: number;
  repo: string;
  sha: string;
  message: string;
  files_changed: number | null;
  committed_at: Date;
  synced_at: Date;
};

/**
 * Insert a commit, or do nothing if (repo, sha) already exists.
 * Returns true if a NEW row was inserted, false if the (repo, sha) pair was
 * already in the table.
 *
 * `ON CONFLICT DO NOTHING` + `RETURNING id` gives us a zero-row result on
 * a duplicate and a one-row result on a fresh insert.
 */
export async function upsertCommit(
  repo: string,
  sha: string,
  message: string,
  committedAt: string,
  filesChanged: number | null,
): Promise<boolean> {
  try {
    const result = await sql<Array<{ id: number }>>`
      INSERT INTO commits (repo, sha, message, committed_at, files_changed)
      VALUES (${repo}, ${sha}, ${message}, ${committedAt}, ${filesChanged})
      ON CONFLICT (repo, sha) DO NOTHING
      RETURNING id
    `;
    return result.length > 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`upsertCommit(${repo}, ${sha}): ${msg}`);
  }
}

/** Most recent N commits across all repos, newest first. */
export async function getRecentCommits(limit = 200): Promise<CommitRow[]> {
  const safe = Math.min(Math.max(1, Math.floor(limit)), 1000);

  const rows = await sql<CommitRow[]>`
    SELECT id, repo, sha, message, files_changed, committed_at, synced_at
    FROM commits
    ORDER BY committed_at DESC, id DESC
    LIMIT ${safe}
  `;
  return rows.map((r) => ({ ...r }));
}

/** Most recent sync timestamp (max of synced_at), or null if no commits cached. */
export async function getLastSyncedAt(): Promise<Date | null> {
  const rows = await sql<Array<{ synced_at: Date }>>`
    SELECT synced_at
    FROM commits
    ORDER BY synced_at DESC
    LIMIT 1
  `;
  return rows[0]?.synced_at ?? null;
}

/**
 * Per-repo commit counts. SQL GROUP BY now — postgres.js makes a server-side
 * aggregate just as easy as a client-side one.
 */
export async function getCommitCountsByRepo(): Promise<
  Array<{ repo: string; count: number }>
> {
  const rows = await sql<Array<{ repo: string; count: number }>>`
    SELECT repo, COUNT(*)::int AS count
    FROM commits
    GROUP BY repo
    ORDER BY repo ASC
  `;
  return rows.map((r) => ({ ...r }));
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
  const rows = await sql<Array<{ repo: string }>>`
    SELECT DISTINCT repo
    FROM commits
    WHERE sha LIKE ${lower + "%"}
  `;
  return rows.map((r) => r.repo);
}
