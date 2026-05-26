import sql from "./db";

// Row shape as we expose it to the rest of the app. Mirrors the Postgres
// `notes` table columns. postgres.js returns timestamptz as native Date.
export type NoteRow = {
  id: number;
  content: string;
  created_at: Date;
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

  try {
    const rows = await sql<NoteRow[]>`
      INSERT INTO notes (content, repo)
      VALUES (${trimmed}, ${cleanRepo})
      RETURNING id, content, created_at, repo
    `;
    if (rows.length === 0) {
      throw new Error("addNote: insert returned no row");
    }
    return { ...rows[0] };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("addNote:")) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`addNote: ${msg}`);
  }
}

/**
 * Return the most recent N notes, newest first. Default 50, capped at 200.
 */
export async function getRecentNotes(limit = 50): Promise<NoteRow[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 200);

  const rows = await sql<NoteRow[]>`
    SELECT id, content, created_at, repo
    FROM notes
    ORDER BY created_at DESC, id DESC
    LIMIT ${safeLimit}
  `;
  return rows.map((r) => ({ ...r }));
}

/** Look up a single note by id, or null if not found. */
export async function getNoteById(id: number): Promise<NoteRow | null> {
  const rows = await sql<NoteRow[]>`
    SELECT id, content, created_at, repo
    FROM notes
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ? { ...rows[0] } : null;
}

/**
 * Delete a note by id. Returns true if a row was deleted, false if no row
 * matched (silent no-op rather than throw).
 */
export async function deleteNote(id: number): Promise<boolean> {
  try {
    const result = await sql<Array<{ id: number }>>`
      DELETE FROM notes WHERE id = ${id} RETURNING id
    `;
    return result.length > 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`deleteNote(${id}): ${msg}`);
  }
}
