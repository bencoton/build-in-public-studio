"use client";

// Route-segment error boundary. Catches any error thrown by a server component,
// server action, or client component below the app/ root that isn't otherwise
// handled. Must be a client component because it owns `reset()`.
//
// We deliberately surface the error message rather than hiding it — this is a
// developer tool, not a consumer product, and "something went wrong" with no
// details would make debugging a Monday-morning cron failure miserable.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The full error (including stack) goes to the browser console for the
    // developer; we don't echo the stack to the page UI.
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <AlertTriangle className="size-6 text-amber-400" />
            Something went wrong
          </CardTitle>
          <CardDescription>
            An error was thrown while rendering this page. The message below is
            from the server; the full stack is in your browser console.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <pre className="font-mono text-sm bg-muted/50 border border-border rounded-md p-4 whitespace-pre-wrap break-words">
            {error.message || "(no message)"}
          </pre>

          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Vercel digest: {error.digest}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            If this keeps happening, the most common causes are a missing env
            var (Anthropic key, GitHub token, DATABASE_URL) or a Claude API
            timeout. Check{" "}
            <Link href="/settings" className="text-wyco-teal hover:underline">
              Settings
            </Link>{" "}
            to verify your keys are still valid.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
