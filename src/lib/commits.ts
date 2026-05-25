import { db } from "./db";

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
 * Returns true if a new row was inserted, false otherwise.
 */
export function upsertCommit(
  repo: string,
  sha: string,
  message: string,
  committedAt: string,
  filesChanged: number | null,
): boolean {
  const result = db
    .prepare(
      `INSERT INTO commits (repo, sha, message, committed_at, files_changed)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(repo, sha) DO NOTHING`,
    )
    .run(repo, sha, message, committedAt, filesChanged) as { changes: number };
  return result.changes > 0;
}

/** Most recent N commits across all repos, newest first. */
export function getRecentCommits(limit = 200): CommitRow[] {
  const safe = Math.min(Math.max(1, Math.floor(limit)), 1000);
  return db
    .prepare(
      `SELECT id, repo, sha, message, files_changed, committed_at, synced_at
         FROM commits
         ORDER BY committed_at DESC, id DESC
         LIMIT ?`,
    )
    .all(safe) as CommitRow[];
}

/** Most recent sync timestamp (max of synced_at), or null if no commits cached yet. */
export function getLastSyncedAt(): string | null {
  const row = db
    .prepare("SELECT MAX(synced_at) AS latest FROM commits")
    .get() as { latest: string | null };
  return row.latest;
}

/** Total commits cached for each repo (for the debug summary). */
export function getCommitCountsByRepo(): Array<{ repo: string; count: number }> {
  return db
    .prepare(
      `SELECT repo, COUNT(*) AS count
         FROM commits
         GROUP BY repo
         ORDER BY repo`,
    )
    .all() as Array<{ repo: string; count: number }>;
}
