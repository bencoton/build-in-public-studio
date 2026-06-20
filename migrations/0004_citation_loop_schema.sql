-- Migration 0004 — Reddit drafting + Citation loop schema.
--
-- Companion to docs/specs/reddit-and-citation-tracking-spec.md.
--
-- Apply: paste this file's contents into Neon's SQL editor (Console →
-- SQL Editor → New query → paste → Run) and confirm it returns "Success".
-- NOT idempotent: the ALTER/CREATE statements fail if already applied, so do
-- not re-run on a database that already has these objects. The split below
-- lets you apply Part A (Reddit, Phase 1.5c) now and Part B (citations,
-- Phase 2.5) later if you prefer — each part is self-contained.
--
-- Conventions (match 0001–0003): bigserial PKs, timestamptz everywhere,
-- jsonb for JSON-shaped columns, CHECK constraints for enums, explicit
-- indexes. No RLS policies (single-user app via the connection string;
-- add policies when auth lands — see 0001 header).

-- ════════════════════════════════════════════════════════════════════════
--  PART A — Reddit drafting (Phase 1.5c)
-- ════════════════════════════════════════════════════════════════════════

-- 1. Extend the drafts.variant enum to include 'reddit'.
--    (Postgres CHECK constraints can't be altered in place — drop + recreate.)
ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_variant_check;
ALTER TABLE drafts
  ADD CONSTRAINT drafts_variant_check
  CHECK (variant IN ('x_thread', 'ih_long', 'reddit'));

-- 2. Target subreddit for reddit drafts. NULL for x_thread / ih_long.
--    Curated slugs only (rules config lives in src/lib/reddit-subs.ts).
ALTER TABLE drafts
  ADD COLUMN subreddit text
    CHECK (subreddit IS NULL
           OR subreddit IN ('SaaS', 'indiehackers', 'SideProject', 'microsaas'));

-- 3. Enforce the variant ↔ subreddit relationship:
--    reddit rows MUST have a subreddit; non-reddit rows must NOT.
ALTER TABLE drafts
  ADD CONSTRAINT drafts_reddit_subreddit_check
  CHECK (
    (variant = 'reddit'  AND subreddit IS NOT NULL) OR
    (variant <> 'reddit' AND subreddit IS NULL)
  );

-- 4. Reddit post title, separate from the self-text in `content`.
--    (Open question D1 — included now to avoid a later migration; harmless
--     for x_thread / ih_long which leave it NULL.)
ALTER TABLE drafts
  ADD COLUMN title text;

-- Partial index: fast lookup of reddit drafts by sub for the history filter.
CREATE INDEX idx_drafts_subreddit
  ON drafts (subreddit)
  WHERE subreddit IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════
--  PART B — Citation tracking loop (Phase 2.5)
-- ════════════════════════════════════════════════════════════════════════

-- ── tracked_prompts ─────────────────────────────────────────────────────────
-- The prompts a user wants to monitor, per project. The scanner reads the
-- `active` rows and asks each to the configured engine(s).
CREATE TABLE tracked_prompts (
  id           bigserial   PRIMARY KEY,
  repo         text        NOT NULL,             -- "owner/name", matches watched_repos.full_name
  prompt_text  text        NOT NULL,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracked_prompts_repo   ON tracked_prompts (repo);
CREATE INDEX idx_tracked_prompts_active ON tracked_prompts (active) WHERE active;

-- ── scan_runs ───────────────────────────────────────────────────────────────
-- One row per scanner invocation. Makes silent scanner failures visible
-- (WoW: surface silent failures). Supports B1.3.
CREATE TABLE scan_runs (
  id               bigserial   PRIMARY KEY,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  status           text        NOT NULL DEFAULT 'running'
                               CHECK (status IN ('running', 'success', 'partial', 'failed')),
  prompts_scanned  integer     NOT NULL DEFAULT 0,
  results_written  integer     NOT NULL DEFAULT 0,
  error            text                              -- populated on partial/failed
);
CREATE INDEX idx_scan_runs_started_at ON scan_runs (started_at DESC);

-- ── citation_results ────────────────────────────────────────────────────────
-- Time-series. One row per (prompt × engine × scan). `sources` stores the full
-- parsed citation list so the matcher can be re-run later without re-querying.
--   cited     = brand_domain appeared in the engine's SOURCES list (strong).
--   mentioned = brand_name appeared in the answer TEXT but domain was NOT
--               in sources (weaker). Both false = absence (still recorded).
CREATE TABLE citation_results (
  id              bigserial   PRIMARY KEY,
  prompt_id       bigint      NOT NULL REFERENCES tracked_prompts (id) ON DELETE CASCADE,
  repo            text        NOT NULL,             -- denormalised for fast per-project queries
  engine          text        NOT NULL
                              CHECK (engine IN ('perplexity', 'gemini', 'openai')),
  cited           boolean     NOT NULL DEFAULT false,
  mentioned       boolean     NOT NULL DEFAULT false,
  matched_url     text,                             -- the exact source URL that matched (when cited)
  answer_excerpt  text,                             -- short snippet of the answer for context
  sources         jsonb,                            -- full parsed [{url, title}] list, for audit / re-match
  scan_run_id     bigint      REFERENCES scan_runs (id) ON DELETE SET NULL,
  scanned_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_citation_results_prompt     ON citation_results (prompt_id);
CREATE INDEX idx_citation_results_repo       ON citation_results (repo);
CREATE INDEX idx_citation_results_scanned_at ON citation_results (scanned_at DESC);
CREATE INDEX idx_citation_results_cited      ON citation_results (repo, cited) WHERE cited;

-- Idempotency guard (B0.6 / open question D5): at most one row per
-- prompt × engine × calendar-day. A re-run inside the same UTC day updates
-- rather than duplicates (use INSERT ... ON CONFLICT in the scanner).
CREATE UNIQUE INDEX uq_citation_results_prompt_engine_day
  ON citation_results (prompt_id, engine, (date_trunc('day', scanned_at AT TIME ZONE 'UTC')));

-- ── drafts: attribution + manual engagement ────────────────────────────────
-- promoted_url      — the URL this post drives toward; joined against
--                     citation_results to attribute citations to posts (B.6).
-- engagement_manual — paste-in likes/reposts/comments (B0.9). No platform API
--                     is ever called; this is the sanctioned manual alternative.
ALTER TABLE drafts ADD COLUMN promoted_url      text;
ALTER TABLE drafts ADD COLUMN engagement_manual jsonb;
CREATE INDEX idx_drafts_promoted_url ON drafts (promoted_url) WHERE promoted_url IS NOT NULL;

-- ── settings: brand match config + BYO keys ────────────────────────────────
-- Reuses the existing key-value `settings` table (open question D2) with
-- namespaced keys. No DDL needed — documented here so the keys are canonical:
--
--   citation.brand_name.<repo>    e.g. "Build-in-Public Studio"
--   citation.brand_domain.<repo>  e.g. "build-in-public-studio.vercel.app"
--   apikey.perplexity             AES-256-GCM ciphertext (node:crypto),
--                                 decryptable only with env ENCRYPTION_KEY,
--                                 shared by the Vercel app + homelab container.
--   apikey.gemini / apikey.openai (P2 engines, same encrypted form)
--
-- The scanner reads these via SELECT on settings and decrypts in-container.

-- ── done ────────────────────────────────────────────────────────────────────
