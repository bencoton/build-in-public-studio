"use client";

// Big client component — one per moment on the dashboard.
// Owns: active-tab state, edit-mode state per variant, all action buttons.

import { useState, useTransition } from "react";
import {
  Pencil,
  RefreshCw,
  Check,
  X,
  RotateCcw,
  Copy,
  Loader2,
  AlertCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  saveDraftEditAction,
  regenerateDraftAction,
  setDraftStatusAction,
} from "@/app/dashboard-actions";
import type { MomentWithDrafts, DraftRow } from "@/lib/moments";

type Variant = "x_thread" | "ih_long";
const VARIANT_LABEL: Record<Variant, string> = {
  x_thread: "X thread",
  ih_long: "Indie Hackers",
};

export function MomentCard({ moment }: { moment: MomentWithDrafts }) {
  const [activeTab, setActiveTab] = useState<Variant>("x_thread");

  const xThread = moment.drafts.find((d) => d.variant === "x_thread");
  const ihLong = moment.drafts.find((d) => d.variant === "ih_long");
  const active = activeTab === "x_thread" ? xThread : ihLong;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-xs font-mono mb-2">
          <Badge variant="outline">{moment.source_type}</Badge>
          {moment.source_refs.length > 0 && (
            <span className="text-muted-foreground truncate">
              {moment.source_refs.slice(0, 4).join(", ")}
              {moment.source_refs.length > 4 ? "…" : ""}
            </span>
          )}
        </div>
        <h3 className="text-base font-medium leading-snug">{moment.summary}</h3>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Hand-rolled tabs — two buttons + conditional content. Two tabs
            don't justify pulling in @radix-ui/react-tabs. */}
        <div className="flex gap-0 border-b">
          {(["x_thread", "ih_long"] as const).map((v) => {
            const draft = v === "x_thread" ? xThread : ihLong;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setActiveTab(v)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2 flex items-center gap-2",
                  activeTab === v
                    ? "border-wyco-teal text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {VARIANT_LABEL[v]}
                {draft && <StatusDot status={draft.status} />}
              </button>
            );
          })}
        </div>

        {active ? (
          <DraftVariant draft={active} />
        ) : (
          <p className="text-sm text-muted-foreground italic py-4">
            (missing — Claude didn't return this variant)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── One variant (the content + actions) ──────────────────────────────────

function DraftVariant({ draft }: { draft: DraftRow }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(draft.content);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, startEditTransition] = useTransition();

  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenPending, startRegenTransition] = useTransition();

  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusPending, startStatusTransition] = useTransition();

  const muted = draft.status === "rejected";

  // ── Action handlers ────────────────────────────────────────────────────

  const handleSaveEdit = () => {
    setEditError(null);
    startEditTransition(async () => {
      const r = await saveDraftEditAction(draft.id, editValue);
      if (!r.ok) {
        setEditError(r.error);
      } else {
        setIsEditing(false);
      }
    });
  };

  const handleCancelEdit = () => {
    setEditValue(draft.content);
    setIsEditing(false);
    setEditError(null);
  };

  const handleRegenerate = () => {
    setRegenError(null);
    if (isEditing) handleCancelEdit();
    startRegenTransition(async () => {
      const r = await regenerateDraftAction(draft.id);
      if (!r.ok) setRegenError(r.error);
      // On success, revalidatePath in the action triggers a server re-render
      // and the new content arrives as a fresh draft.content prop.
    });
  };

  const handleSetStatus = (next: "draft" | "approved" | "rejected") => {
    setStatusError(null);
    startStatusTransition(async () => {
      const r = await setDraftStatusAction(draft.id, next);
      if (!r.ok) setStatusError(r.error);
    });
  };

  const isApproved = draft.status === "approved";
  const isRejected = draft.status === "rejected";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <StatusBadge status={draft.status} />
        {draft.posted_url && (
          <a
            href={draft.posted_url}
            target="_blank"
            rel="noreferrer"
            className="text-wyco-teal hover:underline font-mono"
          >
            posted ↗
          </a>
        )}
      </div>

      {/* Content — either rendered or editable */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-sans leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[10rem]"
          />
          {editError && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="size-4" />
              {editError}
            </p>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "rounded-md border bg-card/50 p-4 text-sm whitespace-pre-wrap leading-relaxed font-sans",
            muted && "text-muted-foreground opacity-60",
            regenPending && "opacity-50",
          )}
        >
          {draft.content}
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        {isEditing ? (
          <>
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
              onClick={handleCancelEdit}
              disabled={editPending}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            {!isRejected && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  disabled={regenPending || statusPending}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={regenPending || statusPending}
                >
                  {regenPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  {regenPending ? "Regenerating..." : "Regenerate"}
                </Button>
              </>
            )}

            {/* Status transitions */}
            {!isApproved && !isRejected && (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSetStatus("approved")}
                  disabled={statusPending || regenPending}
                >
                  <Check className="size-3.5" />
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSetStatus("rejected")}
                  disabled={statusPending || regenPending}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                  Reject
                </Button>
              </>
            )}

            {isApproved && (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled
                  title="Copy + Open ships in Stage 7"
                >
                  <Copy className="size-3.5" />
                  Copy + Open (Stage 7)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSetStatus("draft")}
                  disabled={statusPending}
                >
                  <RotateCcw className="size-3.5" />
                  Revert
                </Button>
              </>
            )}

            {isRejected && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleSetStatus("draft")}
                disabled={statusPending}
              >
                <RotateCcw className="size-3.5" />
                Restore to draft
              </Button>
            )}
          </>
        )}
      </div>

      {regenError && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="size-4" />
          {regenError}
        </p>
      )}
      {statusError && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="size-4" />
          {statusError}
        </p>
      )}
    </div>
  );
}

// ── Status indicators ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DraftRow["status"] }) {
  switch (status) {
    case "approved":
      return <Badge variant="success">Approved</Badge>;
    case "rejected":
      return <Badge variant="secondary">Rejected</Badge>;
    case "posted":
      return <Badge variant="success">Posted</Badge>;
    case "draft":
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
}

/** Tiny coloured dot next to the tab label so you can see the variant's
 *  state without switching tabs. */
function StatusDot({ status }: { status: DraftRow["status"] }) {
  const color =
    status === "approved" || status === "posted"
      ? "bg-wyco-teal"
      : status === "rejected"
        ? "bg-muted-foreground"
        : "bg-foreground/30";
  return <span className={cn("size-1.5 rounded-full", color)} />;
}
