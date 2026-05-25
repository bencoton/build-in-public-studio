import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles } from "lucide-react";

import { getLatestGeneration } from "@/lib/moments";
import { relativeTime } from "@/lib/format";

import { GenerateNowButton } from "@/components/dashboard/generate-now-button";
import { MomentCard } from "@/components/dashboard/moment-card";

// The real dashboard. Server-renders the latest generation's moments;
// each moment card is a client component that owns the edit / regenerate /
// approve / reject lifecycle for its two variants.

export default function DashboardPage() {
  const moments = getLatestGeneration();
  const latestAt = moments[0]?.created_at;

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
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {moments.length} moment{moments.length === 1 ? "" : "s"} —{" "}
            {moments.filter((m) =>
              m.drafts.some((d) => d.status === "approved"),
            ).length}{" "}
            with an approved variant
          </h3>

          <div className="space-y-4">
            {moments.map((moment) => (
              <MomentCard key={moment.id} moment={moment} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
