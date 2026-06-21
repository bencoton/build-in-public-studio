import { readApiKeyState } from "@/lib/env-keys";
import {
  getWatchedRepos,
  getScheduleCron,
  getBannedWords,
  getStyleNotes,
  getRedditSubs,
} from "@/lib/settings";
import { getSubredditViews } from "@/lib/subreddits";

import { ApiKeysSection } from "./api-keys-section";
import { WatchedReposSection } from "./watched-repos-section";
import { RedditAutoGenSection } from "./reddit-autogen-section";
import { ManageSubredditsSection } from "./manage-subreddits-section";
import { PreferencesForm } from "./preferences-form";

// Async server component — env state is sync (just reads process.env), but
// the four DB reads are now async (Postgres via postgres.js). Promise.all
// runs them in parallel so the page TTFB is one round-trip, not four
// sequential ones.

// Reads Postgres at request time — never statically prerender (build-time DB
// reads are stale and can crash on prerender; BIPS-L7).
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const keys = readApiKeyState();
  const [watched, scheduleCron, bannedWords, styleNotes, subreddits] =
    await Promise.all([
      getWatchedRepos(),
      getScheduleCron(),
      getBannedWords(),
      getStyleNotes(),
      getSubredditViews(),
    ]);

  // Each watched repo's Reddit auto-gen subs (parallel; empty = off).
  const redditSubsEntries = await Promise.all(
    watched.map(
      async (repo) => [repo, await getRedditSubs(repo)] as [string, string[]],
    ),
  );
  const redditSubs: Record<string, string[]> =
    Object.fromEntries(redditSubsEntries);

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          API keys, watched repos, schedule, and tone. Keys live in{" "}
          <code className="font-mono">.env.local</code> (never the database).
          Everything else is stored in Postgres.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          API keys
        </h3>
        <ApiKeysSection anthropic={keys.anthropic} github={keys.github} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          GitHub repos
        </h3>
        <WatchedReposSection
          githubSet={keys.github === "set"}
          initialWatched={watched}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Reddit auto-generation
        </h3>
        <RedditAutoGenSection
          repos={watched}
          catalog={subreddits}
          initial={redditSubs}
        />
        <ManageSubredditsSection initialCatalog={subreddits} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Schedule and tone
        </h3>
        <PreferencesForm
          scheduleCron={scheduleCron}
          bannedWords={bannedWords}
          styleNotes={styleNotes}
        />
      </section>
    </div>
  );
}
