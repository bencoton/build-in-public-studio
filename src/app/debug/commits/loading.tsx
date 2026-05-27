import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DebugCommitsLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      <Skeleton className="h-10 w-40" />

      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i}>
            <CardContent className="py-3 flex items-center justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
