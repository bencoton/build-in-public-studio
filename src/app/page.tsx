import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles } from "lucide-react";

import { getLatestGeneration, type MomentWithDrafts } from "@/lib/moments";
import { relativeTime, displayProjectName } from "@/lib/format";

import { GenerateNowButton } from "@/components/dashboard/generate-now-button";
import { MomentCard } from "@/components/dashboard/moment-card";
import {
  ProjectTabs,
  type ProjectTab,
} from "@/components/dashboard/project-tabs";
import { ScheduledSection } from "@/components/dashboard/scheduled-section";

// "Generate now" calls generateDrafts() server-side; on a cold container that
// can take 60–120s. Pro tier caps at 300s; opt in so the action doesn't time
// out during a manual trigger.
export const maxDuration = 300;

// The real dashboard. Server-renders the latest generation's moments;
// each moment card is a client component that owns the edit / regenerate /
// approve / reject lifecycle for its two variants. Project tabs above the
// list let you focus on one project at a time and see at a glance which
// projects are fully actioned.

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DashboardPage({
  searchParams,
}: {
  // Next 15+/16: searchParams is a Promise that must be awaited (sync
  // access silently returns undefined on client-side navigations).
  searchParams: Promise<SearchParams>;
}) {
  const [moments, params] = await Promise.all([
    getLatestGeneration(),
    searchParams,
  ]);
  const latestAt = moments[0]?.created_at;

  const rawProject =
    typeof params.project === "string" ? params.project : "all";
  const { tabs, activeKey, filteredMoments } = buildProjectView(
    moments,
    rawProject,
  );

  const approvedCount = filteredMoments.filter((m) =>
    m.drafts.some((d) => d.status === "approved"),
  ).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">
          This week&apos;s drafts
        </h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Story-worthy moments from your GitHub activity and notes. Two variants
          per moment — X thread and Indie Hackers long-form. Edit, regenerate,
          approve, reject.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-wyco-teal" />
            Generate
          </CardTitle>
          <CardDescription>
            {moments.length === 0
              ? "No drafts yet — click below to generate from this week's commits + notes."
              : `Latest generation: ${latestAt ? relativeTime(latestAt) : "never"}. Re-generate to replace.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenerateNowButton />
        </CardContent>
      </Card>

      {/* Scheduled-for-the-next-7-days lives between the Generate panel and
          the latest generation. Pulls from the dashboard live query — no
          background cron required (Phase 1.5b decision). Renders nothing if
          no scheduled drafts are due. */}
      <ScheduledSection />

      {moments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing drafted yet. Click &quot;Generate this week&apos;s
            drafts&quot; above. You&apos;ll need at least one commit from a
            watched repo or one note from the last 7 days.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <ProjectTabs tabs={tabs} activeKey={activeKey} />

          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {filteredMoments.length} moment
            {filteredMoments.length === 1 ? "" : "s"}
            {activeKey !== "all" && ` in ${prettyKey(activeKey)}`} —{" "}
            {approvedCount} with an approved variant
          </h3>

          {filteredMoments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No moments in this project for the latest generation.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredMoments.map((moment) => (
                <MomentCard key={moment.id} moment={moment} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Group the latest generation's moments by project, compute the tab list
 * (with allActioned flag), and filter the moments to the active tab.
 *
 * Tab order: All, General, then projects alphabetically. Stable across renders.
 */
function buildProjectView(
  moments: MomentWithDrafts[],
  rawActiveKey: string,
): {
  tabs: ProjectTab[];
  activeKey: string;
  filteredMoments: MomentWithDrafts[];
} {
  // Bucket moments by project key. NULL repo → "general".
  const buckets = new Map<string, MomentWithDrafts[]>();
  for (const m of moments) {
    const key = m.repo ?? "general";
    const list = buckets.get(key) ?? [];
    list.push(m);
    buckets.set(key, list);
  }

  // Decide the active key — fall back to "all" if the URL points to a project
  // that has no moments this week (stale link).
  const activeKey = rawActiveKey === "all" || buckets.has(rawActiveKey) ? rawActiveKey : "all";

  // Build tabs. "All" first, then "General" if present, then projects sorted.
  const tabs: ProjectTab[] = [];
  tabs.push({
    key: "all",
    label: "All",
    count: moments.length,
    allActioned: moments.length > 0 && moments.every(momentFullyActioned),
  });

  if (buckets.has("general")) {
    const list = buckets.get("general")!;
    tabs.push({
      key: "general",
      label: "General",
      count: list.length,
      allActioned: list.every(momentFullyActioned),
    });
  }

  const projectKeys = Array.from(buckets.keys())
    .filter((k) => k !== "general")
    .sort();
  for (const key of projectKeys) {
    const list = buckets.get(key)!;
    tabs.push({
      key,
      // Strip the "owner/" prefix for display — your own username on every
      // tab is noise. The key keeps the full form for URL stability.
      label: displayProjectName(key),
      count: list.length,
      allActioned: list.every(momentFullyActioned),
    });
  }

  // Filter moments to the active tab.
  const filteredMoments =
    activeKey === "all"
      ? moments
      : (buckets.get(activeKey) ?? []);

  return { tabs, activeKey, filteredMoments };
}

/**
 * A moment is "fully actioned" when EVERY one of its draft variants has been
 * decided — approved, rejected, or posted. Any variant still in 'draft' means
 * there's still a decision to make.
 */
function momentFullyActioned(moment: MomentWithDrafts): boolean {
  return moment.drafts.every((d) => d.status !== "draft");
}

function prettyKey(key: string): string {
  if (key === "general") return "General";
  return displayProjectName(key);
}
