import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { getWatchedRepos } from "@/lib/settings";
import {
  getRecentCommits,
  getLastSyncedAt,
  getCommitCountsByRepo,
} from "@/lib/commits";
import { relativeTime } from "@/lib/format";

import { SyncButton } from "./sync-button";

// Debug view. Not linked in the sidebar — reach via the URL or the dashboard
// "Sync GitHub" button (wired in Stage 6). The whole page is server-rendered;
// the only client island is the Sync button.

export default function DebugCommitsPage() {
  const watched = getWatchedRepos();
  const lastSyncedAt = getLastSyncedAt();
  const countsByRepo = getCommitCountsByRepo();
  const commits = getRecentCommits(100);

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">
          Debug · Commits
        </h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Raw view of the GitHub commit cache. Useful for confirming the sync
          works before Stage 5 starts feeding this data to Claude.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Sync status</CardTitle>
          <CardDescription>
            {watched.length === 0 ? (
              <>
                No watched repos. Pick some in{" "}
                <a href="/settings" className="text-wyco-teal hover:underline">
                  Settings
                </a>{" "}
                first.
              </>
            ) : (
              <>
                Watching <strong>{watched.length}</strong> repo
                {watched.length === 1 ? "" : "s"}. Last sync:{" "}
                <span className="font-mono">
                  {lastSyncedAt ? relativeTime(lastSyncedAt) : "never"}
                </span>
                .
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {watched.length > 0 && <SyncButton />}
          {countsByRepo.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Cached per repo
              </div>
              <ul className="text-xs font-mono space-y-0.5">
                {countsByRepo.map((r) => (
                  <li key={r.repo}>
                    {r.repo}:{" "}
                    <span className="text-foreground">{r.count}</span> commit
                    {r.count === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recent commits (newest first, max 100)
        </h3>

        {commits.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No commits cached yet.{" "}
              {watched.length > 0
                ? "Click \"Sync now\" above to pull from GitHub."
                : "Add a watched repo in Settings, then sync."}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {commits.map((c) => (
              <li key={c.id}>
                <Card>
                  <CardContent className="py-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <Badge variant="outline">{c.repo}</Badge>
                      <span className="text-muted-foreground">
                        {c.sha.slice(0, 7)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {relativeTime(c.committed_at)}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {firstLine(c.message)}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Show only the first line of a commit message in the list. */
function firstLine(message: string): string {
  const i = message.indexOf("\n");
  return i === -1 ? message : message.slice(0, i);
}
