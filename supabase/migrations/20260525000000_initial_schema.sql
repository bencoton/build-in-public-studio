-- Initial schema migration for Build-in-Public Studio.
-- Mirrors the original node:sqlite schema in src/lib/db.ts (now retired).
-- Ported to Postgres with the standard WyCo conventions:
--   - bigserial primary keys (auto-increment, generated identity)
--   - timestamptz for all timestamps (proper time-zone-aware, JS-friendly)
--   - jsonb for JSON-shaped columns (replaces TEXT-of-JSON in SQLite)
--   - RLS enabled on every table per docs/Tech-Stack.md (no policies yet —
--     this is a single-user app accessed via the service-role key. Add
--     policies if/when authentication is added)

-- ── notes ─────────────────────────────────────────────────────────────────
-- Quick-capture entries the user writes during the week. Optionally linked
-- to a watched repo via `repo` (NULL = general / unlinked).
CREATE TABLE notes (
  id           bigserial PRIMARY KEY,
  content      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  repo         text
);
CREATE INDEX idx_notes_created_at ON notes (created_at DESC);
CREATE INDEX idx_notes_repo       ON notes (repo);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- ── watched_repos ─────────────────────────────────────────────────────────
-- Repos the user has selected to pull commits from. full_name is "owner/repo".
CREATE TABLE watched_repos (
  id          bigserial   PRIMARY KEY,
  full_name   text        NOT NULL UNIQUE,
  added_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE watched_repos ENABLE ROW LEVEL SECURITY;

-- ── commits ───────────────────────────────────────────────────────────────
-- Cached GitHub activity. files_changed is null until we backfill from
-- per-commit API calls (Stage 5+).
CREATE TABLE commits (
  id             bigserial   PRIMARY KEY,
  repo           text        NOT NULL,
  sha            text        NOT NULL,
  message        text        NOT NULL,
  files_changed  integer,
  committed_at   timestamptz NOT NULL,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repo, sha)
);
CREATE INDEX idx_commits_committed_at ON commits (committed_at DESC);
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;

-- ── moments ───────────────────────────────────────────────────────────────
-- Story-worthy chunks identified by Claude. source_ref is a JSON array of
-- string identifiers (commit SHAs or note IDs). `repo` is derived at insert
-- time from the source refs and used by the History page's project filter.
CREATE TABLE moments (
  id              bigserial   PRIMARY KEY,
  summary         text        NOT NULL,
  source_type     text        NOT NULL,
  source_ref      jsonb,
  generation_id   text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  repo            text
);
CREATE INDEX idx_moments_repo          ON moments (repo);
CREATE INDEX idx_moments_generation_id ON moments (generation_id);
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;

-- ── drafts ────────────────────────────────────────────────────────────────
-- Two variants per moment (x_thread + ih_long). Lifecycle:
--   draft → approved → posted   (happy path)
--          ↓ rejected (terminal)
-- ON DELETE CASCADE so deleting a moment cleans up its drafts.
CREATE TABLE drafts (
  id          bigserial   PRIMARY KEY,
  moment_id   bigint      NOT NULL REFERENCES moments (id) ON DELETE CASCADE,
  variant     text        NOT NULL CHECK (variant IN ('x_thread', 'ih_long')),
  content     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'approved', 'posted', 'rejected')),
  rating      text        CHECK (rating IS NULL
                                 OR rating IN ('star', 'flop', 'neutral')),
  posted_url  text,
  posted_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_drafts_moment ON drafts (moment_id);
CREATE INDEX idx_drafts_status ON drafts (status);
CREATE INDEX idx_drafts_rating ON drafts (rating) WHERE rating IS NOT NULL;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- ── settings ──────────────────────────────────────────────────────────────
-- Key-value pairs. Used for watched_repos selection, schedule cron, banned
-- words, style notes, last_run_at.
CREATE TABLE settings (
  key         text        PRIMARY KEY,
  value       text        NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
