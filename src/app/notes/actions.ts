"use server";

// "use server" marks every export in this file as a Server Action. The functions
// below run on the server when called from a client component (Next.js handles
// the RPC machinery). They are NOT available to the browser as JavaScript.

import { revalidatePath } from "next/cache";

import { addNote, deleteNote } from "@/lib/notes";

export type SaveNoteResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Server action invoked by the Notes form. Accepts a FormData (the native
 * shape Next passes when a form's `action` prop is a server action) and
 * returns a small result object so the client can show success/error state.
 */
export async function saveNoteAction(
  _prevState: SaveNoteResult | null,
  formData: FormData,
): Promise<SaveNoteResult> {
  const raw = formData.get("content");
  const content = typeof raw === "string" ? raw.trim() : "";
  // The "general" option submits an empty string; treat that and undefined the
  // same way (NULL repo). Any other value is the "owner/name" of a watched repo.
  const rawRepo = formData.get("repo");
  const repo = typeof rawRepo === "string" && rawRepo.trim() !== "" ? rawRepo.trim() : null;

  if (!content) {
    return { ok: false, error: "Write something first — empty notes aren't saved." };
  }
  if (content.length > 50_000) {
    // Arbitrary safety cap; a single note shouldn't be a novel.
    return { ok: false, error: "Note is over 50,000 characters. Split it up." };
  }

  try {
    await addNote(content, repo);
  } catch (err) {
    // Real error path — surface to the UI rather than fail silently.
    // (See docs/Ways-of-Working.md Part 8: never swallow errors.)
    const message = err instanceof Error ? err.message : "Unknown error saving note.";
    return { ok: false, error: message };
  }

  // Tell Next.js to refresh the /notes server-rendered list so the new note shows up.
  revalidatePath("/notes");
  return { ok: true };
}

export type DeleteNoteResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Delete a note by id. Confirmation is the client's responsibility — we trust
 * the caller has already asked the user "are you sure".
 */
export async function deleteNoteAction(id: number): Promise<DeleteNoteResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Invalid note id." };
  }
  try {
    const deleted = await deleteNote(id);
    if (!deleted) {
      return { ok: false, error: "Note not found (may already be deleted)." };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { ok: false, error: message };
  }
  revalidatePath("/notes");
  return { ok: true };
}
