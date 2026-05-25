"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteNoteAction } from "./actions";

/**
 * Small "trash" icon button on each note card. Confirms via window.confirm
 * before deleting — a polished inline-confirm UI can come in Stage 10.
 */
export function DeleteNoteButton({ noteId }: { noteId: number }) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Delete this note? This cannot be undone.",
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteNoteAction(noteId);
      if (!result.ok) {
        // Surface failures with a follow-up alert. Rare path — most likely the
        // note was already deleted from another tab.
        window.alert(`Couldn't delete: ${result.error}`);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={pending}
      aria-label="Delete note"
      className="text-muted-foreground hover:text-destructive size-7"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </Button>
  );
}
