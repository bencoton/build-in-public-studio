import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getScheduledDrafts } from "@/lib/history";
import { displayProjectName, variantLabel } from "@/lib/format";

export default async function ScheduledPage() {
  // Show the next 60 days so users can see everything they have queued up.
  const drafts = await getScheduledDrafts(60);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Scheduled</h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Drafts with a scheduled date, ordered by publish time. Set dates on
          individual drafts from the dashboard or history view.
        </p>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No scheduled drafts yet. Approve a draft and set a scheduled date
            from the dashboard to see it here.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {drafts.map((d) => {
              const when = d.scheduled_for
                ? formatScheduledFor(d.scheduled_for)
                : "";
              const label = variantLabel(d.variant, d.subreddit);
              const project = d.moment_repo
                ? displayProjectName(d.moment_repo)
                : "General";
              return (
                <Link
                  key={d.id}
                  href={`/history?status=${d.status}`}
                  className="block px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono text-foreground">
                          {when}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {project}
                        </Badge>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {label}
                        </span>
                        {d.status === "approved" && (
                          <Badge className="text-[10px] bg-wyco-teal/15 text-wyco-teal border-wyco-teal/30">
                            approved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">
                        {d.moment_summary}
                      </p>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatScheduledFor(d: Date): string {
  const now = new Date();
  const dayKey = (dt: Date) =>
    dt.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const target = dayKey(d);

  const timeLabel = d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  });

  if (target === today) return `Today · ${timeLabel}`;
  if (target === tomorrow) return `Tomorrow · ${timeLabel}`;

  return (
    d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Europe/London",
    }) +
    " · " +
    timeLabel
  );
}
