import { Card, CardContent } from "@/components/ui/card";

// Placeholder. Stage 2 will turn this into the real Notes page (textarea
// + SQLite-backed list of recent notes, markdown supported).
export default function NotesPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <p className="text-sm text-muted-foreground">
          Quick capture for things worth writing about later.
        </p>
      </div>
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Coming in Stage 2.
        </CardContent>
      </Card>
    </div>
  );
}
