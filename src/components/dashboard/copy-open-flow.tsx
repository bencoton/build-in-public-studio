"use client";

// The Copy + Open + "did you publish?" flow. Lives on each approved variant.
// Replaces the disabled placeholder that Stage 6 left as a stub.

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Copy,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { markPostedAction } from "@/app/dashboard-actions";
import { cn } from "@/lib/utils";
import type { DraftRow } from "@/lib/moments";
import { submitUrlFor } from "@/lib/reddit-subs";

type Props = { draft: DraftRow };

// New-post URL for a draft's platform. Reddit is per-sub (its submit page);
// X/IH are fixed. Falls back to Reddit's generic submit if the sub is somehow
// unknown (shouldn't happen — the DB CHECK constrains it).
function platformUrlFor(draft: DraftRow): string {
  if (draft.variant === "x_thread") return "https://x.com/compose/post";
  if (draft.variant === "ih_long") return "https://www.indiehackers.com/new-post";
  if (draft.variant === "reddit" && draft.subreddit) {
    return submitUrlFor(draft.subreddit);
  }
  return "https://www.reddit.com/submit";
}

function platformLabelFor(draft: DraftRow): string {
  if (draft.variant === "x_thread") return "X";
  if (draft.variant === "ih_long") return "Indie Hackers";
  if (draft.variant === "reddit") {
    return draft.subreddit ? `r/${draft.subreddit}` : "Reddit";
  }
  return "Reddit";
}

function postedUrlPlaceholder(draft: DraftRow): string {
  if (draft.variant === "x_thread") return "https://x.com/...";
  if (draft.variant === "ih_long") return "https://indiehackers.com/post/...";
  return "https://reddit.com/r/.../comments/...";
}

// Local UI states for the flow. Server-side draft.status is the source of
// truth for "posted"; the in-between states (copied / asking) are transient
// and live in this component.
type FlowState = "idle" | "copied" | "asking";

export function CopyOpenFlow({ draft }: Props) {
  // If the draft is already "posted", show the permanent posted state and
  // skip the rest of the state machine.
  if (draft.status === "posted") {
    return <PostedState draft={draft} />;
  }

  return <ActiveFlow draft={draft} />;
}

// ── Active flow (draft is approved, not yet posted) ───────────────────────

function ActiveFlow({ draft }: Props) {
  const [state, setState] = useState<FlowState>("idle");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const platformLabel = platformLabelFor(draft);
  const platformUrl = platformUrlFor(draft);

  // Track the timer + focus listener so we can clean them up if the user
  // dismisses early or unmounts.
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const advanceToAsking = () => {
    setState("asking");
    cleanupRef.current?.();
    cleanupRef.current = null;
  };

  const handleCopyOpen = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(draft.content);
    } catch {
      setError(
        "Browser blocked clipboard access. Select the text manually and copy with Ctrl/Cmd+C.",
      );
      return;
    }

    window.open(platformUrl, "_blank", "noopener,noreferrer");
    setState("copied");

    // Auto-advance to "asking" 60s from now OR the moment focus returns to
    // this tab (whichever happens first). The focus event fires when the user
    // clicks back from X/IH — that's the natural "I'm done publishing" signal.
    cleanupRef.current?.();
    const timerId = window.setTimeout(advanceToAsking, 60_000);
    const onFocus = () => {
      window.clearTimeout(timerId);
      window.removeEventListener("focus", onFocus);
      advanceToAsking();
    };
    window.addEventListener("focus", onFocus);
    cleanupRef.current = () => {
      window.clearTimeout(timerId);
      window.removeEventListener("focus", onFocus);
    };
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const r = await markPostedAction(draft.id, url);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Server revalidates /; status flips to "posted"; PostedState renders.
    });
  };

  const handleNotYet = () => {
    setState("idle");
    setUrl("");
    setError(null);
  };

  // ── Render based on state ────────────────────────────────────────────

  if (state === "idle") {
    return (
      <div className="space-y-2">
        <Button type="button" size="sm" onClick={handleCopyOpen}>
          <Copy className="size-3.5" />
          Copy + Open {platformLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-card/50 p-3">
      <div className="flex items-center gap-2 text-sm text-wyco-teal">
        <Check className="size-4" />
        Copied to clipboard. Paste with Ctrl/Cmd+V on{" "}
        <a
          href={platformUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline inline-flex items-center gap-1"
        >
          {platformLabel}
          <ExternalLink className="size-3" />
        </a>
        .
      </div>

      {state === "asking" && (
        <div className="space-y-2 pt-2 border-t">
          <label
            htmlFor={`posted-url-${draft.id}`}
            className="text-sm font-medium"
          >
            Did you publish it?
          </label>
          <p className="text-xs text-muted-foreground">
            Paste the URL of the published post and I&apos;ll mark this as
            posted. The link will appear on the History page.
          </p>
          <input
            id={`posted-url-${draft.id}`}
            type="url"
            placeholder={postedUrlPlaceholder(draft)}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) {
                e.preventDefault();
                handleSave();
              }
            }}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={pending || !url.trim()}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Save URL — mark as posted
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleNotYet}
              disabled={pending}
            >
              Not yet
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p
          className={cn(
            "text-sm text-destructive flex items-start gap-1.5",
            state === "asking" && "pt-1",
          )}
        >
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Posted state (status === "posted" — permanent) ───────────────────────

function PostedState({ draft }: Props) {
  const url = draft.posted_url ?? "";
  return (
    <div className="rounded-md border bg-wyco-teal/5 p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-sm text-wyco-teal">
        <Check className="size-4" />
        Posted to {platformLabelFor(draft)}.
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-wyco-teal hover:underline font-mono inline-flex items-center gap-1 break-all"
        >
          {url}
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <p className="text-xs text-muted-foreground font-mono">
          No URL recorded.
        </p>
      )}
    </div>
  );
}
