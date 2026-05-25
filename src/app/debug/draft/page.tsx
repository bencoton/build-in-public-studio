import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { getLatestGeneration } from "@/lib/moments";
import { relativeTime } from "@/lib/format";

import { GenerateButton } from "./generate-button";

// Debug view of the most recent draft generation. Renders both variants for
// each moment as raw text. The polished dashboard with edit/regenerate/approve
// buttons ships in Stage 6.

export default async function DebugDraftPage() {
  const moments = await getLatestGeneration();
  const latestCreatedAt = moments[0]?.created_at;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Debug · Drafts</h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Manual trigger for the weekly draft generator. Pulls the last 7 days
          of commits + notes, runs them through Claude with structured output,
          renders the result raw below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Generation</CardTitle>
          <CardDescription>
            Last generation:{" "}
            <span className="font-mono">
              {latestCreatedAt ? relativeTime(latestCreatedAt) : "never"}
            </span>
            . Calls cost a few pence each; cache hits make regenerates cheaper.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenerateButton />
        </CardContent>
      </Card>

      {moments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No drafts yet. Click &quot;Generate drafts now&quot; above.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Latest generation — {moments.length} moment
            {moments.length === 1 ? "" : "s"}
          </h3>

          {moments.map((moment) => {
            const xThread = moment.drafts.find((d) => d.variant === "x_thread");
            const ihLong = moment.drafts.find((d) => d.variant === "ih_long");
            return (
              <Card key={moment.id}>
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs font-mono mb-1">
                    <Badge variant="outline">{moment.source_type}</Badge>
                    {moment.source_refs.length > 0 && (
                      <span className="text-muted-foreground">
                        {moment.source_refs.slice(0, 4).join(", ")}
                        {moment.source_refs.length > 4 ? "…" : ""}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base font-medium">
                    {moment.summary}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <DraftBlock label="X thread" content={xThread?.content} />
                  <DraftBlock
                    label="Indie Hackers long-form"
                    content={ihLong?.content}
                  />
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}

function DraftBlock({
  label,
  content,
}: {
  label: string;
  content: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="rounded-md border bg-card/50 p-4 text-sm whitespace-pre-wrap leading-relaxed font-sans">
        {content ?? <span className="text-muted-foreground italic">missing</span>}
      </div>
    </div>
  );
}
