import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

import {
  getAllDrafts,
  getDraftCountsByStatus,
  getProjectsInHistory,
  type HistoryFilters as Filters,
  type DraftRating,
} from "@/lib/history";
import type { DraftStatus } from "@/lib/draft-mutations";
import { relativeTime } from "@/lib/format";

import { HistoryFilters } from "./filters";
import { RatingButtons } from "./rating-buttons";

// Server component. searchParams come from the URL (?status=...&variant=...&rating=...&repo=...)
// and drive a single DB query. The filter dropdowns push new URLs; this page
// re-renders with the new params.

type SearchParams = Record<string, string | string[] | undefined>;

const VALID_STATUS: DraftStatus[] = ["draft", "approved", "posted", "rejected"];
const VALID_VARIANT = ["x_thread", "ih_long"] as const;
const VALID_RATING = ["star", "flop", "neutral", "unrated"] as const;

export default function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const projects = getProjectsInHistory();

  // Repo filter accepts "all", "general", or any value that appears in `projects`.
  // Anything else (stale URL after a repo got removed, manual hand-typed values)
  // is silently treated as "all" so the page never breaks on a bad search param.
  const rawRepo = typeof searchParams.repo === "string" ? searchParams.repo : "all";
  const repoFilter =
    rawRepo === "general" || projects.includes(rawRepo) ? rawRepo : "all";

  const filters: Filters = {
    status: pickEnum(searchParams.status, VALID_STATUS) ?? "all",
    variant: pickEnum(searchParams.variant, VALID_VARIANT) ?? "all",
    rating: pickEnum(searchParams.rating, VALID_RATING) ?? "all",
    repo: repoFilter,
  };

  const drafts = getAllDrafts(filters);
  const counts = getDraftCountsByStatus();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const posted = counts.posted ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">History</h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Every draft you&apos;ve ever generated. Star the ones that worked —
          they get sampled into future draft generations as voice examples,
          which is how the tool learns to sound like you over time.
        </p>
      </div>

      <Card>
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground font-mono">
            {total} draft{total === 1 ? "" : "s"} total &middot;{" "}
            <span className="text-foreground">{posted} posted</span>
          </div>
          <HistoryFilters projects={projects} />
        </CardContent>
      </Card>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No drafts match these filters.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Card>
                <CardContent className="py-4 space-y-3">
                  {/* Header row — moment summary + metadata + rating buttons */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                        <Badge variant="outline">
                          {draft.variant === "x_thread"
                            ? "X thread"
                            : "Indie Hackers"}
                        </Badge>
                        <StatusBadge status={draft.status as DraftStatus} />
                        <Badge
                          variant={draft.moment_repo ? "outline" : "secondary"}
                        >
                          {draft.moment_repo ?? "General"}
                        </Badge>
                        <span className="text-muted-foreground">
                          {relativeTime(draft.updated_at)}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug truncate">
                        {draft.moment_summary}
                      </p>
                    </div>
                    <RatingButtons
                      draftId={draft.id}
                      currentRating={draft.rating as DraftRating | null}
                    />
                  </div>

                  {/* First few lines of the draft content */}
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {draft.content}
                  </p>

                  {/* Posted URL if applicable */}
                  {draft.posted_url && (
                    <a
                      href={draft.posted_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-wyco-teal hover:underline font-mono inline-flex items-center gap-1 break-all"
                    >
                      {draft.posted_url}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DraftStatus }) {
  switch (status) {
    case "approved":
      return <Badge variant="success">Approved</Badge>;
    case "posted":
      return <Badge variant="success">Posted</Badge>;
    case "rejected":
      return <Badge variant="secondary">Rejected</Badge>;
    case "draft":
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
}

function pickEnum<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  if (typeof raw !== "string") return undefined;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}
