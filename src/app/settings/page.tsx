import { Card, CardContent } from "@/components/ui/card";

// Placeholder. Stage 3 will turn this into the real Settings page
// (API keys, watched repos, schedule, tone settings).
export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          API keys, watched repos, schedule, tone.
        </p>
      </div>
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Coming in Stage 3.
        </CardContent>
      </Card>
    </div>
  );
}
