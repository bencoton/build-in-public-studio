-- Phase 1.5 schema additions.
--
-- Apply: paste this file's contents into Neon's SQL editor (Console →
-- SQL Editor → New query → paste → Run) and confirm it returns "Success".
-- Idempotent-ish: the ALTER and CREATE both fail if already applied, so do
-- not re-run on a database that already has these objects.
--
-- Two changes:
--
-- 1. drafts.scheduled_for — optional timestamp marking when a draft is meant
--    to be posted. Populated by the batch-generation flow (auto-staggered
--    Mon+Thu); editable per-draft in the UI; surfaced on the dashboard via a
--    "Scheduled for the next 7 days" section (live query, no background cron
--    per Phase 1.5b scope decision).
--
-- 2. summaries — per-project product summaries. Two top-level concepts:
--      - kind = 'website' — content for a product landing page, encoded as
--        JSON in the content column: { tagline, intro, features }.
--      - kind = 'launch_x' / 'launch_ih' — announcement posts (X thread and
--        Indie Hackers long-form respectively), stored as plain text.
--    Same lifecycle as drafts: draft → approved → posted (or → rejected).
--    Multiple rows per (repo, kind) are allowed; the UI shows the latest
--    when a project is selected, with a "previous versions" link to the rest.

-- ── 1. drafts.scheduled_for ────────────────────────────────────────────────

ALTER TABLE drafts
  ADD COLUMN scheduled_for timestamptz;

-- Partial index — most drafts will have NULL scheduled_for (manually-driven
-- weekly generation doesn't pre-schedule). Indexing only the populated rows
-- keeps the index tiny and the "due in the next 7 days" query fast.
CREATE INDEX idx_drafts_scheduled_for
  ON drafts (scheduled_for)
  WHERE scheduled_for IS NOT NULL;

-- ── 2. summaries ──────────────────────────────────────────────────────────

CREATE TABLE summaries (
  id          bigserial   PRIMARY KEY,
  repo        text        NOT NULL,
  kind        text        NOT NULL
                          CHECK (kind IN ('website', 'launch_x', 'launch_ih')),
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
CREATE INDEX idx_summaries_repo       ON summaries (repo);
CREATE INDEX idx_summaries_kind       ON summaries (kind);
CREATE INDEX idx_summaries_created_at ON summaries (created_at DESC);
