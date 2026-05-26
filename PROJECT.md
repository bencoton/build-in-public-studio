---
project: build-in-public-studio
display_name: Build-in-Public Studio
tagline: Turn your week's commits and notes into ready-to-ship X threads and IH posts.
status: scaffolding
accent_color: teal
github: https://github.com/bencoton/build-in-public-studio
deploy_url:
started: 2026-05-24
last_updated: 2026-05-25
audience: solo devs and indie hackers shipping in public who want a weekly rhythm without writing every post from scratch
public: true
---

# Build-in-Public Studio — Project Metadata

*Single source of truth for cross-project AI summaries. See [`docs/Ways-of-Working.md`](./docs/Ways-of-Working.md) Part 13 for how this file is consumed.*

---

## What this is

A local web dashboard that pulls your week's GitHub activity and weekly notes, asks Claude to identify 3–5 "story-worthy moments", drafts an X thread and an Indie Hackers long-form post for each, and lets you review, edit, approve, and one-click "Copy + Open" the right platform to publish. Runs entirely on your machine — your data, your API keys, your laptop. The hosted SaaS version is a deliberate Phase 2 if the local tool earns the right.

---

## Current phase

**Phase 1b — Tech stack migration.** Stages 9b.1 → 9b.3 complete. App is live on Vercel against Neon Postgres via the `postgres.js` client (transaction-mode pooler, `prepare: false`). Migrated from `better-sqlite3` → Supabase → Neon over two sessions; Supabase config retired, `supabase/` folder removed from the repo (a one-time backup of schema + RPC functions + JSON data dumps lives in `migration-backups/build-in-public-studio/`). **Stage 9b.4 next: Vercel Cron job for the Monday-9am-UK weekly generation**, then Stage 10 polish and Phase 1.5 features.

---

## Shipped recently

<!-- Reverse-chronological log. Append new bullets at the top with each user-visible change. Each bullet: YYYY-MM-DD — what shipped. -->

- **2026-05-26** — Stage 9b.3 shipped: app live on Vercel against Neon Postgres. Mid-deploy the DB client was pivoted again from `@supabase/supabase-js` to **`postgres.js`** (direct SQL, tagged template literals, native `Date` objects on `timestamptz` columns) — cleaner, removes a vendor abstraction, gives us real types end-to-end. Four Vercel-only build errors fixed in flight: JSX apostrophe escape, two `cache_control` type casts past `@anthropic-ai/sdk` type-lag, `Usage` field widening for cache tokens, and `Array.from(repos)[0]` for ES2015-target Set iteration. Repo housekeeping: `.gitattributes` enforcing LF line endings (commit `12109a5`), `.claude/` added to `.gitignore`, retired `supabase/` folder removed (schema + RPC + JSON data dumps preserved in `migration-backups/`).
- **2026-05-25** — Stage 9b.2 shipped: every `src/lib/` DB helper ported from `node:sqlite` to `@supabase/supabase-js`. `db.ts` deleted (zero remaining callers). All `src/app/` server components and server actions updated to await the now-async DB calls. Multi-row transactions (`insertMomentWithDrafts`) handled via a Postgres RPC function in migration `20260525180000_rpc_functions.sql`. Timestamp parser unified into a single `parseTimestamp()` helper that handles both Postgres ISO 8601 with offset and legacy SQLite shapes (the previous one was Invalid-Date-ing on Postgres returns). Ben verified end-to-end: notes round-trip, commits sync, generation, edit / regenerate / approve / reject / Copy+Open / mark-posted, history filters, ratings. Voice-learning loop deferred to user acceptance testing.
- **2026-05-25** — Stage 9b.1 shipped: Supabase project created in London region, CLI linked, initial schema migration `20260525000000_initial_schema.sql` applied (six tables: notes, watched_repos, commits, moments, drafts, settings — all with RLS enabled). TypeScript types generated to `src/types/database.ts`. `@supabase/supabase-js` added to deps. `.env.local` populated with Supabase URL + anon + service-role keys. Foundation for the tech-stack pivot is in place; the DB access layer still uses `node:sqlite` until Stage 9b.2 ports it.
- **2026-05-25** — **Tech stack pivot decision.** Stage 9 (in-process scheduler via Next.js instrumentation hook) abandoned after hitting five sequential webpack-vs-Node bug classes (`node-notifier` fs/net deps, `node-cron` worker scripts, `node:crypto` URI scheme, bare `crypto` resolution). The instrumentation bundle pass in Next.js 14.2.35 is fundamentally hostile to Node-only code. Pivoting to the WyCo standard stack (Supabase + Vercel) — scheduling becomes first-class via Vercel Cron Jobs, `node:sqlite` replaced with Postgres, app gets a live deployable URL for credibility. Lessons captured as BIPS-L5 in `CLAUDE.md`.
- **2026-05-25** — Dashboard polish: project tabs restyled as pill buttons (teal-filled when active, lime when all actioned). `displayProjectName()` helper strips the "owner/" prefix from every project label (dashboard tabs, history badges, notes badges, history filter dropdown). DB and URL params keep the full "owner/name" form for stability.
- **2026-05-25** — Dashboard project filter: pill tabs above the moment list let you focus on one project at a time. Each tab shows count + an ✓ check + lime accent when every draft in that project has been actioned (approved / rejected / posted). URL-driven (?project=owner/name).
- **2026-05-25** — Notes and moments are project-aware: schema migration via a new `addColumnIfMissing()` helper added `repo TEXT` to both tables. The Notes form has a "Link to project" dropdown. Moments derive their repo from source refs at insert time (commits' repos, notes' linked repos). History page got a fourth Project filter dropdown.
- **2026-05-25** — Stage 8 shipped: `/history` page with status / variant / rating / project filters (URL-driven), inline rating buttons (★ / – / 👎 with optimistic UI), and the voice-learning loop wired into Claude — up to 10 random starred drafts are sampled into each generation's user message as voice examples (posted-and-starred preferred).
- **2026-05-25** — Stage 7 shipped: real Copy + Open flow. Click copies the post to clipboard and opens the platform's new-post page. After 60s OR the moment focus returns to the dev tab, a "Did you publish it?" prompt appears with a URL input and Save/Not-yet buttons. Save flips status to "posted" and persists the URL + timestamp.
- **2026-05-25** — Stage 6 shipped: real dashboard. Latest generation's moments grouped on the home page, tabs for X thread and Indie Hackers per moment, per-variant edit (inline textarea) / regenerate (single-variant Claude call, ~5–10s) / approve / reject / revert / restore. Approved variants show a disabled "Copy + Open" placeholder ready for Stage 7. Dashboard "Generate" button works the same as the debug page.
- **2026-05-25** — Stage 5 shipped: Claude drafting via `tool_use` for guaranteed structured JSON output. System prompt + tool schema both cached with `cache_control: ephemeral` — second-call savings of ~90% on the cached portion. `/debug/draft` renders the latest generation's moments with both X-thread and Indie-Hackers-long variants. Also: inline note deletion (with confirm), elapsed-seconds counter on the generate button, and a `transaction()` helper in `db.ts` after hitting BIPS-L3 (node:sqlite has no `.transaction()` method).
- **2026-05-25** — Stage 4 shipped: GitHub commit sync via Octokit's `paginate` helper. Last 7 days of commits per watched repo, cached in SQLite, idempotent re-runs thanks to a `(repo, sha)` UNIQUE constraint. Per-repo error handling (a 404 on one repo doesn't abort the whole sync). `/debug/commits` renders the cache with relative timestamps + short SHAs.
- **2026-05-25** — Stage 3 shipped: Settings page with API-key status cards, inline "how to get this key" walk-throughs for Anthropic and GitHub, smoke-test buttons that hit each API for real, watched-repos multi-select fed by the user's GitHub repo list, and schedule + banned-words + style-notes preferences persisting to the `settings` table.
- **2026-05-25** — Stage 2 shipped: SQLite via Node's built-in `node:sqlite` module (no native bindings, no Visual Studio Build Tools dependency). Notes page saves and lists with relative timestamps. Full schema for the whole app created on first boot (notes, watched_repos, commits, moments, drafts, settings).
- **2026-05-25** — Stage 1 shipped: project docs in place, WyCo-branded dashboard renders on localhost:3000, private GitHub repo created at bencoton/build-in-public-studio, first commit pushed.

---

## Up next

**This week (pivot in progress):**

1. **Stage 9b.1** — Set up Supabase project, install CLI, write initial schema migration, link the project. *In progress.*
2. **Stage 9b.2** — Port DB access layer (notes, commits, moments, drafts, settings, history) from node:sqlite to @supabase/supabase-js.
3. **Stage 9b.3** — Deploy to Vercel. Live URL, private hobby tier.
4. **Stage 9b.4** — Vercel Cron job for the Monday-9am-UK generation. Delete the old instrumentation + scheduler files.

**Next session:**

5. **Phase 1.5a** — Product summaries. Two new generation modes per project: website summary (structured: tagline + paragraphs + feature list) and launch announcement (X thread + IH long-form). Surfaced on a new sidebar item, "Summaries".
6. **Phase 1.5b** — Batch from previous work + scheduling. Custom time window, generates 10–15 moments, auto-staggers release dates. Now trivial on the new stack: a `scheduled_for` column + an hourly Vercel Cron checks the queue.
7. **Stage 10** — Polish: light-mode toggle, loading skeletons, error boundaries, micro-animations.

**Phase 2 (later):**

- OSS launch — flip the GitHub repo to public, polish the README with screenshots, **draft the launch posts using the tool itself**, post to Indie Hackers + X.

---

## Metrics

Nothing to measure yet. Once the app is in use weekly, candidate metrics: drafts generated per week, approval rate, posts actually published, ★ vs ✗ rate from the history page.

---

## Social-post hooks

- 100% Claude-generated code (the entire app, including this docstring)
- Beginner-led — the user is a beginner-leaning dev, every UI choice biases for explainability
- Moments-over-commits — direct competitors are commit-driven, which is noise; this groups by story
- Notes + git fusion — none of the direct competitors take handwritten weekly notes as input
- Copy + Open over auto-publish — humans stay in the loop on every post
- Indie Hackers long-form support, not just X threads

---

## Notes for the AI agent

When this project ships its first user-visible feature, surface that prominently — the OSS-from-day-one credibility loop matters more than incremental polish. Always link to the GitHub repo in posts about this project; the source being visible is half the story.
