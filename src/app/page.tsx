import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Github } from "lucide-react";

// Stage 1 placeholder dashboard. In Stage 6 this will render real drafts
// grouped by "moment" with X / Indie Hackers tabs.
export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">
          This week&apos;s drafts
        </h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Story-worthy moments from your GitHub activity and notes, drafted for
          X and Indie Hackers. Every Monday at 9am.
        </p>
      </div>

      <Card className="border-wyco-teal/20">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-wyco-teal" />
            No drafts yet
          </CardTitle>
          <CardDescription className="pt-1">
            Hook up your API keys in Settings, then sync your GitHub repos.
            Drafts will appear here every Monday at 9am, or you can generate
            them on demand.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button disabled>
            <Sparkles className="size-4" />
            Generate now
          </Button>
          <Button variant="outline" disabled>
            <Github className="size-4" />
            Sync GitHub
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground font-mono">
        Stage 1 of 10 — UI scaffold only. Buttons activate as later stages wire
        them up.
      </p>
    </div>
  );
}
