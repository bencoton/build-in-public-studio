"use client";

// Schedule + tone settings. One form, one save button, three fields.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Clock, Ban, Type } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { savePreferencesAction, type SaveResult } from "./actions";

type Props = {
  scheduleCron: string;
  bannedWords: string[];
  styleNotes: string;
};

const initialState: SaveResult | null = null;

export function PreferencesForm({
  scheduleCron,
  bannedWords,
  styleNotes,
}: Props) {
  const [state, formAction] = useActionState(savePreferencesAction, initialState);

  // Field styling shared across the three inputs.
  const inputClass =
    "w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-sans placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Preferences</CardTitle>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-6">
          {/* Schedule */}
          <div className="space-y-2">
            <label
              htmlFor="schedule_cron"
              className="text-sm font-medium flex items-center gap-2"
            >
              <Clock className="size-4 text-muted-foreground" />
              Schedule (cron)
            </label>
            <input
              id="schedule_cron"
              name="schedule_cron"
              defaultValue={scheduleCron}
              className={`${inputClass} font-mono`}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Default <code className="font-mono">0 9 * * 1</code> = 9am every
              Monday (Europe/London). Used by the AppHeader to compute &quot;Next
              run&quot;; the actual Vercel Cron fires from{" "}
              <code className="font-mono">vercel.json</code> at 08:00 UTC Monday.
            </p>
          </div>

          {/* Banned words */}
          <div className="space-y-2">
            <label
              htmlFor="banned_words"
              className="text-sm font-medium flex items-center gap-2"
            >
              <Ban className="size-4 text-muted-foreground" />
              Banned words
            </label>
            <textarea
              id="banned_words"
              name="banned_words"
              rows={5}
              defaultValue={bannedWords.join("\n")}
              placeholder={"revolutionize\nleverage\nunlock\ndelve"}
              className={`${inputClass} font-mono resize-y min-h-[6rem]`}
            />
            <p className="text-xs text-muted-foreground">
              One word or phrase per line. Claude is told to avoid these when
              drafting. The defaults from your spec (revolutionize, leverage,
              unlock, delve, &quot;in today&apos;s fast-paced world&quot;,
              &quot;I&apos;m excited to share&quot;) are baked into the prompt
              itself — anything you list here is added on top.
            </p>
          </div>

          {/* Style notes */}
          <div className="space-y-2">
            <label
              htmlFor="style_notes"
              className="text-sm font-medium flex items-center gap-2"
            >
              <Type className="size-4 text-muted-foreground" />
              Style notes
            </label>
            <textarea
              id="style_notes"
              name="style_notes"
              rows={6}
              defaultValue={styleNotes}
              placeholder="Free-form. E.g. 'Beginner-leaning, 100% Claude-generated, lean into specifics over generics, mark uncertain claims with [VERIFY].'"
              className={`${inputClass} resize-y min-h-[8rem]`}
            />
            <p className="text-xs text-muted-foreground">
              Pasted into the system prompt as-is. Anything you want Claude to
              know about your voice that isn&apos;t a banned word.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <SaveButton />
            {state?.ok === true && (
              <span className="text-sm text-wyco-teal">{state.message}</span>
            )}
            {state?.ok === false && (
              <span className="text-sm text-destructive">{state.error}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save preferences"}
    </Button>
  );
}
