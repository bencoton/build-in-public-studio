"use client";

// Per-draft scheduled-for editor. Renders as a small inline pill showing the
// scheduled date (or "schedule") that opens to a date input on click. Save
// runs the server action; the page revalidates and the new date appears.

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarPlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateDraftScheduledForAction } from "@/app/dashboard-actions";
import { toLocalDateString } from "@/lib/scheduling";

type Props = {
  draftId: number;
  currentScheduledFor: Date | null;
};

export function ScheduledDateEditor({ draftId, currentScheduledFor }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when opening, so the user can type a date immediately.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const currentLabel = currentScheduledFor
    ? formatScheduledFor(currentScheduledFor)
    : null;

  const handleSave = (value: string | null) => {
    setError(null);
    startTransition(async () => {
      const r = await updateDraftScheduledForAction(draftId, value);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="date"
          defaultValue={
            currentScheduledFor ? toLocalDateString(currentScheduledFor) : ""
          }
          disabled={pending}
          className="rounded-md border border-input bg-card px-2 py-1 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={pending}
          onClick={() => handleSave(inputRef.current?.value || null)}
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          Save
        </Button>
        {currentScheduledFor && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => handleSave(null)}
            title="Remove schedule"
          >
            <X className="size-3" />
            Clear
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1 text-xs hover:bg-muted/50 transition-colors"
      title={
        currentScheduledFor
          ? `Scheduled for ${currentLabel}. Click to edit.`
          : "Click to schedule this draft for a future date."
      }
    >
      <CalendarPlus className="size-3 text-muted-foreground" />
      {currentLabel ?? "Schedule"}
    </button>
  );
}

function formatScheduledFor(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
}
