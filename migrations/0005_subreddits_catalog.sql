-- Migration 0005 — user-managed subreddit catalog.
--
-- Companion to docs/specs/user-managed-subreddits-spec.md.
-- Apply: paste into Neon's SQL editor (Console → SQL Editor → New query →
-- paste → Run) and confirm "Success". NOT idempotent — do not re-run on a DB
-- that already has these objects.
--
-- Purpose: move subreddit definitions out of the hardcoded reddit-subs.ts
-- config into a user-managed catalog, and relax the fixed-slug CHECK on
-- drafts.subreddit (migration 0004 Part A) that limited it to the four
-- curated subs. Conventions match 0001–0004 (bigserial PK, timestamptz,
-- jsonb, explicit indexes).

-- ── subreddits (global catalog) ─────────────────────────────────────────────
-- One row per subreddit the user can target, shared across all projects
-- (selection stays per-project via the reddit.subs.<repo> setting). Only slug
-- + display_name are required; the rule fields are optional (name-only adds),
-- and generation falls back to a generic journey-format steer when they're
-- blank. submit_url is NOT stored — it's derived in-app from the slug
-- (https://www.reddit.com/r/<slug>/submit) to avoid drift.
CREATE TABLE subreddits (
  id                bigserial   PRIMARY KEY,
  slug              text        NOT NULL UNIQUE,   -- e.g. "SaaS", "webdev" (no "r/" prefix)
  display_name      text        NOT NULL,          -- e.g. "r/SaaS"
  tone_note         text,                           -- optional: one-line voice steer for the prompt
  self_promo_rule   text,                           -- optional: human-readable self-promo policy
  prepost_checklist jsonb,                          -- optional: array of checklist strings
  flair_hint        text,                           -- optional: flair guidance (surfaced as text)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── relax drafts.subreddit ──────────────────────────────────────────────────
-- Drop the fixed-slug CHECK from 0004 (it hardcoded the four curated slugs).
-- Validation of the slug now happens in-app against the subreddits catalog.
-- The variant↔subreddit consistency check from 0004
-- (drafts_reddit_subreddit_check) is intentionally KEPT — reddit drafts must
-- still have a subreddit, and non-reddit drafts must not.
ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_subreddit_check;

-- Light format guard so a malformed value (e.g. an "r/" prefix or spaces)
-- can't land in the column. Reddit slugs are alphanumeric + underscore.
-- Permissive on length (1–50) so we don't re-introduce a brittle constraint.
ALTER TABLE drafts
  ADD CONSTRAINT drafts_subreddit_format_check
  CHECK (subreddit IS NULL OR subreddit ~ '^[A-Za-z0-9_]{1,50}$');

-- No FK from drafts.subreddit → subreddits.slug on purpose: removing a sub
-- from the catalog must NOT delete or orphan historical drafts. A draft keeps
-- its stored slug + title even if that sub is later removed from the catalog.

-- ── seeding ─────────────────────────────────────────────────────────────────
-- The four curated subs are seeded from the existing reddit-subs.ts content by
-- an idempotent app-side seed (INSERT ... ON CONFLICT (slug) DO NOTHING) — see
-- the spec / implementation prompt. Not seeded here, to keep the curated prose
-- in one reviewed place rather than duplicating it into SQL.
