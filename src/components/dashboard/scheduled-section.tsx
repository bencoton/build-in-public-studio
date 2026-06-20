// Dashboard's "Scheduled for the next 7 days" section. Server component —
// runs a live query against the drafts table filtered to scheduled_for in the
// upcoming window. Phase 1.5b decision: no background cron, the dashboard
// surfaces due items via this query at render time.

import Link from "next/link";
import { CalendarClock, ExternalLink } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getScheduledDrafts } from "@/lib/history";
import { displayProjectName, variantLabel } from "@/lib/format";

export async function ScheduledSection() {
  const drafts = await getScheduledDrafts(7);

  if (drafts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <CalendarClock className="size-4" />
        Scheduled for the next 7 days
      </h3>

      <Card>
        <CardContent className="p-0 divide-y">
          {drafts.map((d) => {
            const when = d.scheduled_for ? formatScheduledFor(d.scheduled_for) : "";
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
                      <span className="font-mono text-foreground">{when}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
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
                    <p className="text-sm text-foreground line-clamp-1">
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
    </section>
  );
}

/**
 * Compact "Mon 2 Jun · 9am" style. Today / Tomorrow get a friendlier label.
 */
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

  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }) + ` · ${timeLabel}`;
}
