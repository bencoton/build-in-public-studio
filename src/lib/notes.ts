import { supabase } from "./supabase";

// Row shape as we expose it to the rest of the app. Mirrors the Postgres
// `notes` table columns plus the convention that `created_at` comes back as
// an ISO 8601 string from Supabase (timestamptz → JSON serialised by PostgREST).
export type NoteRow = {
  id: number;
  content: string;
  created_at: string;
  repo: string | null;
};

/**
 * Insert a new note. Empty / whitespace-only content is rejected.
 *
 * @param repo optional "owner/repo" string linking the note to a project.
 *             Pass null (or omit) for a general / unlinked note.
 */
export async function addNote(
  content: string,
  repo: string | null = null,
): Promise<NoteRow> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Note content is empty.");
  }
  const cleanRepo = repo && repo.trim().length > 0 ? repo.trim() : null;

  const { data, error } = await supabase
    .from("notes")
    .insert({ content: trimmed, repo: cleanRepo })
    .select("id, content, created_at, repo")
    .single();

  if (error) throw new Error(`addNote: ${error.message}`);
  if (!data) throw new Error("addNote: insert returned no row");
  return data;
}

/**
 * Return the most recent N notes, newest first. Default 50, capped at 200.
 */
export async function getRecentNotes(limit = 50): Promise<NoteRow[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 200);

  const { data, error } = await supabase
    .from("notes")
    .select("id, content, created_at, repo")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`getRecentNotes: ${error.message}`);
  return data ?? [];
}

/** Look up a single note by id, or null if not found. */
export async function getNoteById(id: number): Promise<NoteRow | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("id, content, created_at, repo")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getNoteById(${id}): ${error.message}`);
  return data ?? null;
}

/**
 * Delete a note by id. Returns true if a row was deleted, false if no row
 * matched (silent no-op rather than throw).
 */
export async function deleteNote(id: number): Promise<boolean> {
  const { error, count } = await supabase
    .from("notes")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) throw new Error(`deleteNote(${id}): ${error.message}`);
  return (count ?? 0) > 0;
}
