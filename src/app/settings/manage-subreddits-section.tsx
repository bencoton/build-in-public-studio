"use client";

// Manage subreddits — the user-managed catalog. Add (name required, rule
// fields optional), edit, and remove subs without a code change. The catalog
// feeds the per-project selector above and every moment's Reddit picker.

import { useState, useTransition } from "react";
import { Loader2, Check, AlertCircle, Plus, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SubredditView } from "@/lib/subreddits";
import {
  createSubredditAction,
  updateSubredditAction,
  deleteSubredditAction,
} from "./actions";

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelClass = "text-xs font-medium text-muted-foreground";

const SELF_PROMO_PLACEHOLDER =
  "Optional but recommended — the sub's self-promo policy, e.g. \"Value-first only; bare link-drops get removed; use the weekly promo thread for pure plugs.\" Drives the pre-post checklist.";

export function ManageSubredditsSection({
  initialCatalog,
}: {
  initialCatalog: SubredditView[];
}) {
  const [subs, setSubs] = useState<SubredditView[]>(initialCatalog);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Manage subreddits</CardTitle>
        <CardDescription>
          The catalog of subreddits you can target. Adding needs only a name —
          tone and rules are optional (a sub with no rules still drafts, using a
          generic journey steer). Filling the self-promo rule powers the
          pre-post checklist that helps drafts clear mod filters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subreddits yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {subs.map((sub) => (
              <SubRow
                key={sub.slug}
                sub={sub}
                onUpdated={(updated) =>
                  setSubs((prev) =>
                    prev.map((s) => (s.slug === updated.slug ? updated : s)),
                  )
                }
                onRemoved={() =>
                  setSubs((prev) => prev.filter((s) => s.slug !== sub.slug))
                }
              />
            ))}
          </ul>
        )}

        <AddForm onAdded={(s) => setSubs((prev) => [...prev, s])} />
      </CardContent>
    </Card>
  );
}

// ── One existing sub: inline editor for the optional rule fields + remove ───

function SubRow({
  sub,
  onUpdated,
  onRemoved,
}: {
  sub: SubredditView;
  onUpdated: (s: SubredditView) => void;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [toneNote, setToneNote] = useState(sub.toneNote ?? "");
  const [selfPromoRule, setSelfPromoRule] = useState(sub.selfPromoRule ?? "");
  const [checklist, setChecklist] = useState(
    (sub.prePostChecklist ?? []).join("\n"),
  );
  const [flairHint, setFlairHint] = useState(sub.flairHint ?? "");

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const patch = {
        toneNote,
        selfPromoRule,
        prePostChecklist: checklist.split("\n"),
        flairHint,
      };
      const r = await updateSubredditAction(sub.slug, patch);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved(true);
      onUpdated({
        ...sub,
        toneNote: toneNote.trim() || null,
        selfPromoRule: selfPromoRule.trim() || null,
        prePostChecklist:
          checklist
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean).length > 0
            ? checklist
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
            : null,
        flairHint: flairHint.trim() || null,
      });
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const r = await deleteSubredditAction(sub.slug);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onRemoved();
    });
  };

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-mono font-medium hover:text-wyco-teal transition-colors"
        >
          {sub.displayName}
          {!sub.selfPromoRule && !sub.toneNote && (
            <span className="ml-2 text-xs font-sans font-normal text-muted-foreground">
              (no rules — generic steer)
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {pending && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          {!pending && saved && (
            <span className="text-xs text-wyco-teal flex items-center gap-1">
              <Check className="size-3.5" />
              saved
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Edit"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={remove}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <Field label="Tone note (optional)">
            <textarea
              value={toneNote}
              onChange={(e) => setToneNote(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="One-line voice steer fed into the prompt, e.g. 'Show, don't sell.'"
            />
          </Field>
          <Field label="Self-promo rule (optional)">
            <textarea
              value={selfPromoRule}
              onChange={(e) => setSelfPromoRule(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder={SELF_PROMO_PLACEHOLDER}
            />
          </Field>
          <Field label="Pre-post checklist (optional, one item per line)">
            <textarea
              value={checklist}
              onChange={(e) => setChecklist(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder={"No bare link-drops\nMentions the product at most once"}
            />
          </Field>
          <Field label="Flair hint (optional)">
            <input
              type="text"
              value={flairHint}
              onChange={(e) => setFlairHint(e.target.value)}
              className={inputClass}
              placeholder="e.g. Tag with 'Self-Promotion' flair"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={save} disabled={pending}>
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
    </li>
  );
}

// ── Add a new sub ───────────────────────────────────────────────────────────

function AddForm({ onAdded }: { onAdded: (s: SubredditView) => void }) {
  const [name, setName] = useState("");
  const [toneNote, setToneNote] = useState("");
  const [selfPromoRule, setSelfPromoRule] = useState("");
  const [checklist, setChecklist] = useState("");
  const [flairHint, setFlairHint] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setToneNote("");
    setSelfPromoRule("");
    setChecklist("");
    setFlairHint("");
    setShowOptional(false);
  };

  const add = () => {
    setError(null);
    startTransition(async () => {
      const r = await createSubredditAction({
        name,
        toneNote,
        selfPromoRule,
        prePostChecklist: checklist.split("\n"),
        flairHint,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onAdded(r.subreddit);
      reset();
    });
  };

  return (
    <div className="rounded-md border border-dashed p-3 space-y-3">
      <p className="text-sm font-medium">Add a subreddit</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[12rem] space-y-1">
          <label className={labelClass} htmlFor="new-sub-name">
            Subreddit name
          </label>
          <input
            id="new-sub-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !showOptional) {
                e.preventDefault();
                add();
              }
            }}
            className={`${inputClass} font-mono`}
            placeholder="webdev (no 'r/')"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowOptional((s) => !s)}
        >
          {showOptional ? "Hide rules" : "Add rules"}
        </Button>
        <Button type="button" size="sm" onClick={add} disabled={pending || !name.trim()}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          Add
        </Button>
      </div>

      {showOptional && (
        <div className="space-y-3 pt-1">
          <Field label="Tone note (optional)">
            <textarea
              value={toneNote}
              onChange={(e) => setToneNote(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="One-line voice steer, e.g. 'Show, don't sell.'"
            />
          </Field>
          <Field label="Self-promo rule (optional)">
            <textarea
              value={selfPromoRule}
              onChange={(e) => setSelfPromoRule(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder={SELF_PROMO_PLACEHOLDER}
            />
          </Field>
          <Field label="Pre-post checklist (optional, one item per line)">
            <textarea
              value={checklist}
              onChange={(e) => setChecklist(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder={"No bare link-drops\nMentions the product at most once"}
            />
          </Field>
          <Field label="Flair hint (optional)">
            <input
              type="text"
              value={flairHint}
              onChange={(e) => setFlairHint(e.target.value)}
              className={inputClass}
              placeholder="e.g. Tag with 'Self-Promotion' flair"
            />
          </Field>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}
