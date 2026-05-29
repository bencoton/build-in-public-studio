import Link from "next/link";
import { Globe, Megaphone, FolderOpen } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWatchedRepos } from "@/lib/settings";
import {
  getLatestSummariesForRepo,
  parseWebsiteContent,
  type SummaryRow,
} from "@/lib/summaries";
import { displayProjectName } from "@/lib/format";

import { WebsiteSummaryCard } from "./website-summary-card";
import { LaunchSummaryCard } from "./launch-summary-card";

// Server-action-driven Claude calls. Website summary ~20-30s; launch
// announcement ~30-50s. Both fit in Hobby's 60s cap.
export const maxDuration = 60;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SummariesPage({
  searchParams,
}: {
  // Next 15+/16: searchParams is a Promise that must be awaited. Accessing
  // properties synchronously returns undefined and silently breaks the page
  // on client-side navigations.
  searchParams: Promise<SearchParams>;
}) {
  const [watchedRepos, params] = await Promise.all([
    getWatchedRepos(),
    searchParams,
  ]);
  const rawRepo = typeof params.repo === "string" ? params.repo : "";
  const activeRepo = watchedRepos.includes(rawRepo) ? rawRepo : "";

  let summaries: SummaryRow[] = [];
  if (activeRepo) {
    summaries = await getLatestSummariesForRepo(activeRepo);
  }

  const websiteSummary = summaries.find((s) => s.kind === "website") ?? null;
  const launchXSummary = summaries.find((s) => s.kind === "launch_x") ?? null;
  const launchIhSummary = summaries.find((s) => s.kind === "launch_ih") ?? null;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Summaries</h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Per-project product summaries. Two modes: <strong>website</strong>{" "}
          (tagline, intro, feature list — ready for a landing page) and{" "}
          <strong>launch announcement</strong> (X thread + Indie Hackers
          long-form, with the same voice rules as your weekly drafts).
        </p>
      </div>

      {/* Project picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FolderOpen className="size-4 text-wyco-teal" />
            Project
          </CardTitle>
          <CardDescription>
            Pick a watched repo to generate or view summaries for it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {watchedRepos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No watched repos yet —{" "}
              <Link
                href="/settings"
                className="text-wyco-teal hover:underline"
              >
                add some in Settings
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {watchedRepos.map((repo) => (
                <Link
                  key={repo}
                  href={`/summaries?repo=${encodeURIComponent(repo)}`}
                  className={
                    activeRepo === repo
                      ? "px-3 py-1.5 rounded-full bg-wyco-teal text-primary-foreground text-sm font-mono"
                      : "px-3 py-1.5 rounded-full border border-input text-sm font-mono hover:bg-muted/50 transition-colors"
                  }
                >
                  {displayProjectName(repo)}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!activeRepo ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Pick a project above to see its summaries.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Website summary */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Globe className="size-4" />
              Website summary
            </h3>
            <WebsiteSummaryCard
              repo={activeRepo}
              summary={websiteSummary}
              parsed={
                websiteSummary
                  ? parseWebsiteContent(websiteSummary.content)
                  : null
              }
            />
          </section>

          {/* Launch announcement (two variants in one card with tabs) */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Megaphone className="size-4" />
              Launch announcement
            </h3>
            <LaunchSummaryCard
              repo={activeRepo}
              xSummary={launchXSummary}
              ihSummary={launchIhSummary}
            />
          </section>
        </>
      )}
    </div>
  );
}
