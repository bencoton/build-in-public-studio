import { Calendar, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWatchedRepos } from "@/lib/settings";

import { BatchForm } from "./batch-form";

// Server-action-driven Claude generation. Two-phase pipeline in
// src/lib/claude.ts (identify + parallel drafts) keeps wall-clock under
// 60s even for the batch path's 10-15 moments. Hobby tier compatible.
export const maxDuration = 60;

export default async function BatchPage() {
  const watchedRepos = await getWatchedRepos();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
          <Calendar className="size-7 text-wyco-teal" />
          Batch generate
        </h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Fill the posting calendar from a longer time window. Generates up to
          15 moments and auto-staggers them across upcoming Mondays and
          Thursdays. Each draft&apos;s date is editable on the dashboard later.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-wyco-teal" />
            Configure a batch
          </CardTitle>
          <CardDescription>
            10–15 moments × 2 variants each takes ~90–180s on a cold start.
            Cost: roughly £0.20–£0.60 per batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BatchForm watchedRepos={watchedRepos} />
        </CardContent>
      </Card>
    </div>
  );
}
