"use client";

// Launch announcement display + actions. Two variants in tabs (X thread / IH
// long), each backed by its own row in the summaries table. Per-variant
// actions: Edit (inline textarea), Copy (to clipboard), Open platform
// (compose page in a new tab). Regenerate redrafts BOTH variants from the
// project's full history (one Claude call returns both).

import { useState, useTransition } from "react";
import {
  Pencil,
  RefreshCw,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  Copy,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { SummaryRow } from "@/lib/summaries";
import {
  generateLaunchAnnouncementAction,
  saveSummaryEditAction,
} from "./actions";

type Variant = "x" | "ih";

const PLATFORM_LABEL: Record<Variant, string> = {
  x: "X thread",
  ih: "Indie Hackers",
};
const COMPOSE_URL: Record<Variant, string> = {
  x: "https://x.com/compose/post",
  ih: "https://www.indiehackers.com/new-post",
};

type Props = {
  repo: string;
  xSummary: SummaryRow | null;
  ihSummary: SummaryRow | null;
};

export function LaunchSummaryCard({ repo, xSummary, ihSummary }: Props) {
  const [activeTab, setActiveTab] = useState<Variant>("x");
  const [genPending, startGenTransition] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const handleGenerate = () => {
    setGenError(null);
    const startedAt = Date.now();
    const tick = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    startGenTransition(async () => {
      try {
        const r = await generateLaunchAnnouncementAction(repo);
        if (!r.ok) setGenError(r.error);
      } finally {
        clearInterval(tick);
        setElapsed(0);
      }
    });
  };

  // Empty state — neither variant exists yet.
  if (!xSummary && !ihSummary) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            No launch announcement yet. One Claude call produces both the X
            thread and the Indie Hackers long-form version.
          </p>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={genPending}
          >
            {genPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {genPending
              ? `Generating... ${elapsed}s`
              : "Generate launch announcement"}
          </Button>
          {genError && (
            <p className="text-sm text-destructive flex items-center justify-center gap-1.5">
              <AlertCircle className="size-4" />
              {genError}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const active = activeTab === "x" ? xSummary : ihSummary;

  return (
    <Card>
      <CardContent className="py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-0 border-b">
          {(["x", "ih"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setActiveTab(v)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2",
                activeTab === v
                  ? "border-wyco-teal text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {PLATFORM_LABEL[v]}
            </button>
          ))}
        </div>

        {active ? (
          <LaunchVariant summary={active} variant={activeTab} />
        ) : (
          <p className="text-sm text-muted-foreground italic py-4">
            (this variant is missing — regenerate to produce both)
          </p>
        )}

        {/* Regenerate at the card footer regenerates BOTH variants. */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={genPending}
          >
            {genPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {genPending
              ? `Regenerating... ${elapsed}s`
              : "Regenerate both variants"}
          </Button>
          {genError && (
            <span className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="size-4" />
              {genError}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── One variant ──────────────────────────────────────────────────────────

function LaunchVariant({
  summary,
  variant,
}: {
  summary: SummaryRow;
  variant: Variant;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(summary.content);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, startEditTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleSaveEdit = () => {
    setEditError(null);
    startEditTransition(async () => {
      const r = await saveSummaryEditAction(summary.id, editValue);
      if (!r.ok) {
        setEditError(r.error);
      } else {
        setEditing(false);
      }
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // older browsers without Clipboard API
    }
  };

  const handleOpenPlatform = () => {
    window.open(COMPOSE_URL[variant], "_blank", "noopener,noreferrer");
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          rows={12}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-sans leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[12rem]"
        />
        {editError && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="size-4" />
            {editError}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSaveEdit}
            disabled={editPending}
          >
            {editPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditValue(summary.content);
              setEditing(false);
            }}
            disabled={editPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {summary.posted_url && (
        <div className="text-xs flex items-center gap-2">
          <Badge variant="success">Posted</Badge>
          <a
            href={summary.posted_url}
            target="_blank"
            rel="noreferrer"
            className="text-wyco-teal hover:underline font-mono"
          >
            view live ↗
          </a>
        </div>
      )}

      <div className="rounded-md border bg-card/50 p-4 text-sm whitespace-pre-wrap leading-relaxed font-sans">
        {summary.content}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
          {copied ? (
            <Check className="size-3.5 text-wyco-teal" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button type="button" size="sm" onClick={handleOpenPlatform}>
          <ExternalLink className="size-3.5" />
          Open {PLATFORM_LABEL[variant]}
        </Button>
      </div>
    </div>
  );
}
