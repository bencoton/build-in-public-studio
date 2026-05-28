import { Octokit } from "octokit";
import { RequestError } from "@octokit/request-error";

import { getGithubToken } from "./env-keys";
import { getWatchedRepos } from "./settings";
import { upsertCommit } from "./commits";

/*
  GitHub commit sync. For each watched repo, fetches commits from the last
  7 days using Octokit's paginate helper (handles multi-page responses for us),
  then upserts each into the Postgres `commits` table.

  Errors are collected per repo rather than thrown, so one bad repo doesn't
  abort the whole sync — common when a fine-grained token lacks access to a
  specific selected repo (you'd see a 404 there but everything else still works).
*/

export type RepoSyncResult = {
  repo: string;
  ok: true;
  fetched: number;
  inserted: number;
} | {
  repo: string;
  ok: false;
  error: string;
  status?: number;
};

export type SyncSummary = {
  startedAt: string;
  finishedAt: string;
  repos: RepoSyncResult[];
  totalFetched: number;
  totalInserted: number;
};

/**
 * Sync all watched repos. Pulls commits from the last 7 days; idempotent
 * thanks to the (repo, sha) UNIQUE constraint.
 */
export async function syncWatchedRepos(): Promise<SyncSummary> {
  const token = getGithubToken();
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set. Configure it in Settings first.");
  }

  const watched = await getWatchedRepos();
  const startedAt = new Date().toISOString();

  if (watched.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      repos: [],
      totalFetched: 0,
      totalInserted: 0,
    };
  }

  const octokit = new Octokit({ auth: token });
  // GitHub commits API expects ISO timestamps with timezone.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const results: RepoSyncResult[] = [];

  for (const fullName of watched) {
    const [owner, repo] = fullName.split("/");
    if (!owner || !repo) {
      results.push({
        repo: fullName,
        ok: false,
        error: `Invalid repo name "${fullName}" — expected "owner/repo".`,
      });
      continue;
    }

    try {
      // octokit.paginate flattens all pages into a single array.
      const commits = await octokit.paginate(
        octokit.rest.repos.listCommits,
        { owner, repo, since, per_page: 100 },
      );

      let inserted = 0;
      for (const c of commits) {
        // The list endpoint doesn't include file counts — those need a per-commit
        // call which would multiply our API usage. Leave null for now; Stage 5
        // can fetch counts for just the commits Claude picks as moments.
        const committedAt =
          c.commit.committer?.date ?? c.commit.author?.date ?? startedAt;
        const message = c.commit.message ?? "";
        const wasNew = await upsertCommit(
          fullName,
          c.sha,
          message,
          committedAt,
          null,
        );
        if (wasNew) inserted++;
      }

      results.push({
        repo: fullName,
        ok: true,
        fetched: commits.length,
        inserted,
      });
    } catch (err) {
      results.push(toErrorResult(fullName, err));
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    repos: results,
    totalFetched: results.reduce(
      (sum, r) => sum + (r.ok ? r.fetched : 0),
      0,
    ),
    totalInserted: results.reduce(
      (sum, r) => sum + (r.ok ? r.inserted : 0),
      0,
    ),
  };
}

/** Convert an Octokit / network error into a structured result. */
function toErrorResult(repo: string, err: unknown): RepoSyncResult {
  if (err instanceof RequestError) {
    let friendly: string;
    if (err.status === 404) {
      friendly =
        "404 from GitHub — token doesn't have access to this repo, or the repo name is wrong.";
    } else if (err.status === 401) {
      friendly = "401 from GitHub — token rejected. Has it expired?";
    } else if (err.status === 403) {
      friendly =
        "403 from GitHub — rate-limited, or token lacks Contents:Read on this repo.";
    } else {
      friendly = `GitHub returned ${err.status}: ${err.message}`;
    }
    return { repo, ok: false, error: friendly, status: err.status };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { repo, ok: false, error: `Sync failed: ${message}` };
}
