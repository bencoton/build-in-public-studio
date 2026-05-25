import { db } from "./db";

// Row shape as it comes out of node:sqlite. TEXT timestamps come back as strings.
export type NoteRow = {
  id: number;
  content: string;
  created_at: string;
  repo: string | null; // "owner/name" linking to a watched repo, or NULL for general
};

/**
 * Insert a new note. Empty / whitespace-only content is rejected — the caller
 * (the server action) should already have validated, but we double-check here
 * because cheap.
 *
 * @param repo optional "owner/repo" string linking the note to a project.
 *             Pass null (or omit) for a general / unlinked note.
 *
 * Note on typing: node:sqlite's .prepare() returns a StatementSync whose
 * methods return `Record<string, SQLOutputValue>`. We assert the shape after
 * the call since the schema is fixed and we control both ends.
 */
export function addNote(content: string, repo: string | null = null): NoteRow {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Note content is empty.");
  }
  const cleanRepo = repo && repo.trim().length > 0 ? repo.trim() : null;
  // RETURNING is supported by the SQLite version that ships with Node 22.5+.
  const stmt = db.prepare(
    "INSERT INTO notes (content, repo) VALUES (?, ?) RETURNING id, content, created_at, repo",
  );
  const row = stmt.get(trimmed, cleanRepo) as NoteRow | undefined;
  if (!row) {
    throw new Error("Failed to insert note.");
  }
  return row;
}

/**
 * Return the most recent N notes, newest first. Default 50, capped at 200 so
 * a bad caller can't ask for the entire table.
 */
export function getRecentNotes(limit = 50): NoteRow[] {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 200);
  const stmt = db.prepare(
    `SELECT id, content, created_at, repo
       FROM notes
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
  );
  return stmt.all(safeLimit) as NoteRow[];
}

/** Look up a single note by id — used by the moment-repo derivation. */
export function getNoteById(id: number): NoteRow | null {
  const row = db
    .prepare("SELECT id, content, created_at, repo FROM notes WHERE id = ?")
    .get(id) as NoteRow | undefined;
  return row ?? null;
}

/**
 * Delete a note by id. Returns true if a row was deleted, false if no row
 * matched (silent no-op rather than throw — callers can decide what to do).
 */
export function deleteNote(id: number): boolean {
  const result = db
    .prepare("DELETE FROM notes WHERE id = ?")
    .run(id) as { changes: number };
  return result.changes > 0;
}
