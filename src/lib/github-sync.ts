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
 * Sync a single repo by full name ("owner/repo"). Extracted so callers can
 * sync one project at a time rather than all at once, keeping each operation
 * within the Vercel Hobby 60s function budget.
 */
export async function syncSingleRepo(
  fullName: string,
  octokit: Octokit,
  since: string,
  startedAt: string,
): Promise<RepoSyncResult> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    return {
      repo: fullName,
      ok: false,
      error: `Invalid repo name "${fullName}" — expected "owner/repo".`,
    };
  }
  try {
    const commits = await octokit.paginate(
      octokit.rest.repos.listCommits,
      { owner, repo, since, per_page: 100 },
    );
    let inserted = 0;
    for (const c of commits) {
      const committedAt =
        c.commit.committer?.date ?? c.commit.author?.date ?? startedAt;
      const wasNew = await upsertCommit(
        fullName,
        c.sha,
        c.commit.message ?? "",
        committedAt,
        null,
      );
      if (wasNew) inserted++;
    }
    return { repo: fullName, ok: true, fetched: commits.length, inserted };
  } catch (err) {
    return toErrorResult(fullName, err);
  }
}

/**
 * Public entry point for syncing a single repo by name. Creates its own
 * Octokit instance so callers don't need to manage token retrieval.
 * Used by the per-repo server action so each call stays under 60s.
 */
export async function syncOneRepo(fullName: string): Promise<RepoSyncResult> {
  const token = getGithubToken();
  if (!token) {
    return { repo: fullName, ok: false, error: "GITHUB_TOKEN is not set. Configure it in Settings first." };
  }
  const octokit = new Octokit({ auth: token });
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startedAt = new Date().toISOString();
  return syncSingleRepo(fullName, octokit, since, startedAt);
}

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
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const results: RepoSyncResult[] = await Promise.all(
    watched.map((fullName) => syncSingleRepo(fullName, octokit, since, startedAt)),
  );

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
