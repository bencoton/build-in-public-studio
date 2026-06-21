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
  Loader2,
  AlertCircle,
  Copy,
  Sparkles,
  ClipboardList,
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
  generateRedditDraftsAction,
} from "@/app/dashboard-actions";
import type { MomentWithDrafts, DraftRow } from "@/lib/moments";
import { MAX_SUBS_PER_GENERATE } from "@/lib/reddit-subs";
import type { SubredditView } from "@/lib/subreddits";
import { CopyOpenFlow } from "./copy-open-flow";
import { ScheduledDateEditor } from "./scheduled-date-editor";

type Variant = "x_thread" | "reddit" | "ih_long";
// Tab order: X thread → Reddit → Indie Hackers.
const TAB_ORDER: Variant[] = ["x_thread", "reddit", "ih_long"];
const VARIANT_LABEL: Record<Variant, string> = {
  x_thread: "X thread",
  reddit: "Reddit",
  ih_long: "Indie Hackers",
};

export function MomentCard({
  moment,
  subreddits,
}: {
  moment: MomentWithDrafts;
  subreddits: SubredditView[];
}) {
  const [activeTab, setActiveTab] = useState<Variant>("x_thread");

  const xThread = moment.drafts.find((d) => d.variant === "x_thread");
  const ihLong = moment.drafts.find((d) => d.variant === "ih_long");
  const redditDrafts = moment.drafts.filter((d) => d.variant === "reddit");
  // The single-draft variants (X / IH); the Reddit tab renders RedditSection.
  const active =
    activeTab === "x_thread"
      ? xThread
      : activeTab === "ih_long"
        ? ihLong
        : undefined;

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
        {/* Hand-rolled tabs — three buttons + conditional content. Still
            doesn't justify pulling in @radix-ui/react-tabs. */}
        <div className="flex gap-0 border-b">
          {TAB_ORDER.map((v) => {
            const single = v === "x_thread" ? xThread : v === "ih_long" ? ihLong : undefined;
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
                {/* X/IH: per-draft dot. Reddit: aggregate dot only if any
                    reddit draft exists (teal if any approved/posted). */}
                {v === "reddit" ? (
                  <RedditTabDot drafts={redditDrafts} />
                ) : (
                  single && <StatusDot status={single.status} />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "reddit" ? (
          <RedditSection moment={moment} subreddits={subreddits} />
        ) : active ? (
          <DraftVariant draft={active} />
        ) : (
          <p className="text-sm text-muted-foreground italic py-4">
            (missing — Claude didn&apos;t return this variant)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Reddit section ────────────────────────────────────────────────────────
// The Reddit tab's panel. Lists any Reddit drafts that already exist (one per
// sub) and offers a multi-select + generate for subs that don't yet have a
// draft. Reuses DraftVariant for the body so edit / regenerate / approve /
// reject / Copy+Open all behave exactly as for X/IH. Reddit stays on-demand
// per moment — generateRedditDraftsAction is unchanged.

function RedditSection({
  moment,
  subreddits,
}: {
  moment: MomentWithDrafts;
  subreddits: SubredditView[];
}) {
  const redditDrafts = moment.drafts.filter((d) => d.variant === "reddit");

  // Subs that already have a draft on this moment (by slug); the picker only
  // offers catalog subs not yet drafted.
  const draftedSubs = new Set(
    redditDrafts.map((d) => d.subreddit).filter((s): s is string => !!s),
  );
  const availableSubs = subreddits.filter((s) => !draftedSubs.has(s.slug));

  const [selected, setSelected] = useState<string[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [genPending, startGenTransition] = useTransition();

  const toggleSub = (slug: string) => {
    setGenError(null);
    setSelected((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_SUBS_PER_GENERATE
          ? prev
          : [...prev, slug],
    );
  };

  const handleGenerate = () => {
    setGenError(null);
    startGenTransition(async () => {
      const r = await generateRedditDraftsAction(moment.id, selected);
      if (!r.ok) {
        setGenError(r.error);
      } else {
        setSelected([]);
      }
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        One draft per subreddit, each tailored to that community&apos;s tone and
        self-promo rules. Manage the list in Settings → Manage subreddits.
      </p>

      {/* Existing reddit drafts, one card per sub */}
      {redditDrafts.length > 0 ? (
        <div className="space-y-4">
          {redditDrafts.map((d) => (
            <RedditDraftCard key={d.id} draft={d} subreddits={subreddits} />
          ))}
        </div>
      ) : (
        // Neutral (not error) empty state — "not generated yet" is distinct
        // from "failed", matching the Stage-10 neutral-vs-error styling.
        <p className="text-sm text-muted-foreground">
          No Reddit draft yet. Pick one or more subreddits below and generate —
          each gets its own draft tailored to that community&apos;s tone and
          rules.
        </p>
      )}

      {/* Sub multi-select + generate (only for subs without a draft yet) */}
      {availableSubs.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {availableSubs.map((sub) => {
              const isOn = selected.includes(sub.slug);
              const atCap =
                !isOn && selected.length >= MAX_SUBS_PER_GENERATE;
              return (
                <button
                  key={sub.slug}
                  type="button"
                  onClick={() => toggleSub(sub.slug)}
                  disabled={atCap || genPending}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    isOn
                      ? "border-wyco-teal bg-wyco-teal/10 text-wyco-teal"
                      : "border-input text-muted-foreground hover:text-foreground",
                    atCap && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {sub.displayName}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={selected.length === 0 || genPending}
            >
              {genPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {genPending
                ? "Generating..."
                : `Generate Reddit draft${selected.length === 1 ? "" : "s"}`}
            </Button>
            <span className="text-xs text-muted-foreground">
              Up to {MAX_SUBS_PER_GENERATE} at once.
            </span>
          </div>

          {genError && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="size-4" />
              {genError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// One existing Reddit draft: title (with copy), the sub's pre-post checklist
// (when it has rules), then the reused DraftVariant for the body + lifecycle.
function RedditDraftCard({
  draft,
  subreddits,
}: {
  draft: DraftRow;
  subreddits: SubredditView[];
}) {
  // Resolve the draft's sub from the catalog. May be null if the sub was
  // removed from the catalog — the draft still renders (slug-derived label).
  const rule = subreddits.find((s) => s.slug === draft.subreddit) ?? null;
  const hasRules =
    !!rule &&
    (!!rule.selfPromoRule ||
      (rule.prePostChecklist != null && rule.prePostChecklist.length > 0) ||
      !!rule.flairHint);

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          {rule ? rule.displayName : `r/${draft.subreddit}`}
        </Badge>
        <StatusDot status={draft.status} />
      </div>

      {/* Title — Reddit posts are title + body. Show it with a copy button so
          it can be pasted into the title field separately from the body. */}
      {draft.title && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Title
            </span>
            <CopyTitleButton title={draft.title} />
          </div>
          <p className="text-sm font-medium leading-snug rounded-md border bg-card/50 px-3 py-2">
            {draft.title}
          </p>
        </div>
      )}

      {/* Pre-post checklist + self-promo rule — only when this sub has rules.
          A bare sub (name-only) hides the block. */}
      {hasRules && rule && <PrePostChecklist rule={rule} />}

      {/* Body + edit / regenerate / approve / reject / Copy+Open — reused. */}
      <DraftVariant draft={draft} />
    </div>
  );
}

function PrePostChecklist({ rule }: { rule: SubredditView }) {
  return (
    <details className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <summary className="flex items-center gap-1.5 cursor-pointer font-medium text-muted-foreground">
        <ClipboardList className="size-3.5" />
        Before you post to {rule.displayName} — self-promo rules
      </summary>
      <div className="pt-2 space-y-2">
        {rule.selfPromoRule && (
          <p className="text-muted-foreground">{rule.selfPromoRule}</p>
        )}
        {rule.prePostChecklist && rule.prePostChecklist.length > 0 && (
          <ul className="space-y-1">
            {rule.prePostChecklist.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <Check className="size-3.5 mt-0.5 shrink-0 text-wyco-teal" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
        {rule.flairHint && (
          <p className="text-muted-foreground italic">{rule.flairHint}</p>
        )}
      </div>
    </details>
  );
}

function CopyTitleButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(title);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — silently no-op; the title is visible to select.
    }
  };
  return (
    <Button type="button" size="sm" variant="ghost" onClick={handleCopy}>
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "Copied" : "Copy title"}
    </Button>
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
  const isPosted = draft.status === "posted";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs flex-wrap">
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
        {/* Schedule editor only shown for actionable drafts. Posted/rejected
            drafts are terminal; their scheduled date is irrelevant. */}
        {draft.status !== "posted" && draft.status !== "rejected" && (
          <ScheduledDateEditor
            draftId={draft.id}
            currentScheduledFor={draft.scheduled_for}
          />
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
            {/* Edit + Regenerate available for draft and approved (not rejected, not posted). */}
            {!isRejected && !isPosted && (
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

            {/* Approve + Reject only available from the draft state. */}
            {!isApproved && !isRejected && !isPosted && (
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

            {/* Approved drafts get a Revert button alongside the Copy+Open panel below. */}
            {isApproved && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleSetStatus("draft")}
                disabled={statusPending}
              >
                <RotateCcw className="size-3.5" />
                Revert to draft
              </Button>
            )}

            {/* Rejected drafts can only be restored to draft. */}
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

      {/* Copy + Open flow lives below the action row. Renders the active flow
          for approved drafts; renders the permanent "posted" panel for posted
          drafts. Hidden for draft / rejected states. */}
      {(isApproved || isPosted) && !isEditing && (
        <CopyOpenFlow draft={draft} />
      )}

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

/** Aggregate dot for the Reddit tab: nothing until at least one reddit draft
 *  exists, then teal if any is approved/posted, else the neutral draft dot. */
function RedditTabDot({ drafts }: { drafts: DraftRow[] }) {
  if (drafts.length === 0) return null;
  const anyLive = drafts.some(
    (d) => d.status === "approved" || d.status === "posted",
  );
  return (
    <span
      className={cn(
        "size-1.5 rounded-full",
        anyLive ? "bg-wyco-teal" : "bg-foreground/30",
      )}
    />
  );
}
