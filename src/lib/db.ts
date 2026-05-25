import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/*
  Local SQLite database for Build-in-Public Studio.

  Uses node:sqlite — Node.js's built-in SQLite module (stable in Node 22.5+,
  fully stable in Node 24+). No npm package needed; the SQLite C library
  ships inside Node itself.

  Strategy:
  - One database file at ./data/bips.sqlite (project root).
  - Opened lazily on first import, then cached as a module-level singleton.
  - Schema is created with CREATE TABLE IF NOT EXISTS on every boot — there
    is no migration tool; we just append columns as the app evolves. This
    works fine for a single-user local app. If we ever ship a hosted version
    (Phase 3 of docs/PLAN.md) we'll switch to Supabase with proper migrations.
  - WAL mode is enabled because it's strictly better for concurrent reads
    (a server component reading while a form submission writes) and has
    essentially zero downsides for a local app.

  Schema covers the whole app, not just Stage 2's notes:
  - notes:         quick-capture entries the user writes during the week
  - watched_repos: GitHub repos to pull commits from (set in Settings, Stage 3)
  - commits:       cached GitHub activity (populated by Stage 4 sync)
  - moments:       story-worthy chunks identified by Claude (Stage 5+)
  - drafts:        X-thread / IH long-form variants per moment (Stage 5+)
  - settings:      key/value pairs (banned words, style notes, schedule cron, etc.)
*/

const DB_PATH = join(process.cwd(), "data", "bips.sqlite");

// Ensure the data/ directory exists before node:sqlite tries to open the file.
mkdirSync(join(process.cwd(), "data"), { recursive: true });

const db = new DatabaseSync(DB_PATH);

// node:sqlite uses .exec("PRAGMA ...") instead of better-sqlite3's .pragma() helper.
// WAL mode: faster reads under concurrent writes; safe for local single-user.
db.exec("PRAGMA journal_mode = WAL");
// Enforce foreign keys (off by default in SQLite for historical reasons).
db.exec("PRAGMA foreign_keys = ON");

// Schema. Idempotent — safe to run on every boot.
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS watched_repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL UNIQUE,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    sha TEXT NOT NULL,
    message TEXT NOT NULL,
    files_changed INTEGER,
    committed_at TEXT NOT NULL,
    synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repo, sha)
  );

  CREATE TABLE IF NOT EXISTS moments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    generation_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
    variant TEXT NOT NULL CHECK (variant IN ('x_thread', 'ih_long')),
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'approved', 'posted', 'rejected')),
    rating TEXT CHECK (rating IS NULL OR rating IN ('star', 'flop', 'neutral')),
    posted_url TEXT,
    posted_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_commits_committed_at ON commits(committed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_drafts_moment ON drafts(moment_id);
`);

export { db };

/**
 * Run `fn` inside a transaction. Wraps with explicit BEGIN / COMMIT / ROLLBACK
 * because node:sqlite (unlike better-sqlite3) does not ship a `.transaction()`
 * helper.
 *
 * If `fn` throws, the changes are rolled back and the original error is
 * re-thrown. If the ROLLBACK itself fails (rare, e.g. the connection died),
 * we swallow it — the underlying error matters more than the rollback noise.
 */
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Swallow rollback failures so the original error surfaces unobscured.
    }
    throw err;
  }
}
