import { readApiKeyState } from "@/lib/env-keys";
import {
  getWatchedRepos,
  getScheduleCron,
  getBannedWords,
  getStyleNotes,
} from "@/lib/settings";

import { ApiKeysSection } from "./api-keys-section";
import { WatchedReposSection } from "./watched-repos-section";
import { PreferencesForm } from "./preferences-form";

// Server component — reads env state and DB settings server-side, then hands
// them to the three client components below as props.

export default function SettingsPage() {
  const keys = readApiKeyState();
  const watched = getWatchedRepos();
  const scheduleCron = getScheduleCron();
  const bannedWords = getBannedWords();
  const styleNotes = getStyleNotes();

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          API keys, watched repos, schedule, and tone. Keys live in{" "}
          <code className="font-mono">.env.local</code> (never the database).
          Everything else is stored in the local SQLite file.
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
