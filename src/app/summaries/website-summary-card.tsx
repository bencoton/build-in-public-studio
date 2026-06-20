"use client";

// Website summary display + actions. Shows tagline / intro / features as a
// formatted block. Three actions: Generate (or Regenerate if one exists),
// Edit (inline form with three fields), Copy (full content to clipboard).

import { useState, useTransition } from "react";
import {
  Pencil,
  RefreshCw,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  Copy,
  Plus,
  Minus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { SummaryRow, WebsiteSummaryContent } from "@/lib/summaries";
import {
  generateWebsiteSummaryAction,
  saveSummaryEditAction,
} from "./actions";

type Props = {
  repo: string;
  summary: SummaryRow | null;
  parsed: WebsiteSummaryContent | null;
};

export function WebsiteSummaryCard({ repo, summary, parsed }: Props) {
  const [genPending, startGenTransition] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editTagline, setEditTagline] = useState(parsed?.tagline ?? "");
  const [editIntro, setEditIntro] = useState(parsed?.intro ?? "");
  const [editFeatures, setEditFeatures] = useState<string[]>(
    parsed?.features ?? [],
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, startEditTransition] = useTransition();

  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    setGenError(null);
    const startedAt = Date.now();
    const tick = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    startGenTransition(async () => {
      try {
        const r = await generateWebsiteSummaryAction(repo);
        if (!r.ok) setGenError(r.error);
      } finally {
        clearInterval(tick);
        setElapsed(0);
      }
    });
  };

  const handleStartEdit = () => {
    setEditTagline(parsed?.tagline ?? "");
    setEditIntro(parsed?.intro ?? "");
    setEditFeatures(parsed?.features ?? []);
    setEditError(null);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!summary) return;
    setEditError(null);
    startEditTransition(async () => {
      const content = JSON.stringify({
        tagline: editTagline.trim(),
        intro: editIntro.trim(),
        features: editFeatures.map((f) => f.trim()).filter(Boolean),
      });
      const r = await saveSummaryEditAction(summary.id, content);
      if (!r.ok) {
        setEditError(r.error);
      } else {
        setEditing(false);
      }
    });
  };

  const handleCopyAll = async () => {
    if (!parsed) return;
    const text = [
      parsed.tagline,
      "",
      parsed.intro,
      "",
      "Features:",
      ...parsed.features.map((f) => `• ${f}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — older browsers without Clipboard API
    }
  };

  // ── Edit mode ────────────────────────────────────────────────────────────

  if (editing && summary) {
    const inputClass =
      "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tagline</label>
            <input
              type="text"
              value={editTagline}
              onChange={(e) => setEditTagline(e.target.value)}
              maxLength={120}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Intro</label>
            <textarea
              rows={6}
              value={editIntro}
              onChange={(e) => setEditIntro(e.target.value)}
              className={`${inputClass} resize-y min-h-[8rem]`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Features</label>
            <div className="space-y-2">
              {editFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={f}
                    onChange={(e) => {
                      const next = [...editFeatures];
                      next[i] = e.target.value;
                      setEditFeatures(next);
                    }}
                    className={inputClass}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditFeatures(editFeatures.filter((_, j) => j !== i))
                    }
                    title="Remove feature"
                  >
                    <Minus className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditFeatures([...editFeatures, ""])}
              >
                <Plus className="size-3.5" />
                Add feature
              </Button>
            </div>
          </div>

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
              onClick={() => setEditing(false)}
              disabled={editPending}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!parsed || !summary) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            No website summary for this project yet. Generate one from the
            project&apos;s commits and notes.
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
              : "Generate website summary"}
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

  // ── Display ──────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardContent className="py-6 space-y-5">
        <div className="space-y-1">
          <Badge variant="outline" className="font-mono text-[10px]">
            Tagline
          </Badge>
          <p className="text-xl font-heading font-medium tracking-tight">
            {parsed.tagline || (
              <span className="text-muted-foreground italic">(empty)</span>
            )}
          </p>
        </div>

        <div className="space-y-1">
          <Badge variant="outline" className="font-mono text-[10px]">
            Intro
          </Badge>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {parsed.intro || (
              <span className="text-muted-foreground italic">(empty)</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            Features
          </Badge>
          {parsed.features.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">(none)</p>
          ) : (
            <ul className="space-y-1.5">
              {parsed.features.map((f, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-wyco-teal mt-0.5">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleStartEdit}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
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
            {genPending ? `Regenerating... ${elapsed}s` : "Regenerate"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopyAll}
          >
            {copied ? (
              <Check className="size-3.5 text-wyco-teal" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied!" : "Copy all"}
          </Button>
        </div>

        {genError && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="size-4" />
            {genError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
