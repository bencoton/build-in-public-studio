"use client";

// The note-input form. Runs in the browser because we need useFormState to
// surface the server action's result (success / error) and useFormStatus to
// disable the button while submission is in flight.

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { saveNoteAction, type SaveNoteResult } from "./actions";

const initialState: SaveNoteResult | null = null;

export function NoteForm() {
  const [state, formAction] = useFormState(saveNoteAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // After a successful save, clear the textarea and put focus back in it so
  // you can keep typing the next note without reaching for the mouse.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      textareaRef.current?.focus();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <label htmlFor="content" className="sr-only">
        New note
      </label>
      <textarea
        ref={textareaRef}
        id="content"
        name="content"
        rows={6}
        placeholder="What's worth writing about this week? Markdown supported. Press Ctrl/Cmd+Enter to save."
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-sans placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[8rem]"
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter submits — handy when the form is the keyboard focus.
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.ok === false && (
          <span className="text-sm text-destructive">{state.error}</span>
        )}
        {state?.ok === true && (
          <span className="text-sm text-wyco-teal">Saved.</span>
        )}
      </div>
    </form>
  );
}

// Split into its own component so useFormStatus reads from the parent form.
// useFormStatus only works inside a child of the <form>.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save note"}
    </Button>
  );
}
