import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      {/* Four sections, each a heading + a card */}
      {Array.from({ length: 4 }, (_, i) => (
        <section key={i} className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Card>
            <CardContent className="py-6 space-y-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}
