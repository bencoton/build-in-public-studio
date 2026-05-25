import { Card, CardContent } from "@/components/ui/card";

// Placeholder. Stage 8 will turn this into the real History page with
// star/flop ratings that feed back into future drafts.
export default function HistoryPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">History</h2>
        <p className="text-sm text-muted-foreground">
          Past posts and how they performed.
        </p>
      </div>
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Coming in Stage 8.
        </CardContent>
      </Card>
    </div>
  );
}
