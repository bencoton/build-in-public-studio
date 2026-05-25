import { db } from "./db";

// Row shape as it comes out of node:sqlite. TEXT timestamps come back as strings.
export type NoteRow = {
  id: number;
  content: string;
  created_at: string;
};

/**
 * Insert a new note. Empty / whitespace-only content is rejected — the caller
 * (the server action) should already have validated, but we double-check here
 * because cheap.
 *
 * Note on typing: node:sqlite's .prepare() returns a StatementSync whose
 * methods return `Record<string, SQLOutputValue>`. We assert the shape after
 * the call since the schema is fixed and we control both ends.
 */
export function addNote(content: string): NoteRow {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Note content is empty.");
  }
  // RETURNING is supported by the SQLite version that ships with Node 22.5+.
  const stmt = db.prepare(
    "INSERT INTO notes (content) VALUES (?) RETURNING id, content, created_at",
  );
  const row = stmt.get(trimmed) as NoteRow | undefined;
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
    `SELECT id, content, created_at
       FROM notes
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
  );
  return stmt.all(safeLimit) as NoteRow[];
}
