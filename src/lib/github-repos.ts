import { getGithubToken } from "./env-keys";

export type GithubRepo = {
  fullName: string; // "owner/repo"
  private: boolean;
  description: string | null;
  pushedAt: string | null;
};

export type RepoListResult =
  | { ok: true; repos: GithubRepo[] }
  | { ok: false; error: string };

/**
 * List up to 100 of the user's most-recently-pushed repos.
 *
 * 100 is the GitHub API's per-page max. For Stage 3 we don't paginate —
 * if a user has more than 100 repos, the most-recently-pushed are what
 * they're probably watching anyway. If pagination becomes important we'll
 * switch to Octokit's paginate helper in Stage 4.
 */
export async function listUserRepos(): Promise<RepoListResult> {
  const token = getGithubToken();
  if (!token) {
    return { ok: false, error: "GITHUB_TOKEN is not set in .env.local." };
  }

  try {
    const res = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        // Don't cache — settings page should show fresh data each load.
        cache: "no-store",
      },
    );

    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, error: "GitHub rejected the token (401)." };
      }
      return { ok: false, error: `GitHub returned ${res.status}.` };
    }

    type RawRepo = {
      full_name: string;
      private: boolean;
      description: string | null;
      pushed_at: string | null;
    };

    const raw = (await res.json()) as RawRepo[];
    const repos: GithubRepo[] = raw.map((r) => ({
      fullName: r.full_name,
      private: r.private,
      description: r.description,
      pushedAt: r.pushed_at,
    }));
    return { ok: true, repos };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error.";
    return { ok: false, error: `Network error: ${message}` };
  }
}
