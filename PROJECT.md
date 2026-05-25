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
last_session_progress: 2026-05-25
audience: solo devs and indie hackers shipping in public who want a weekly rhythm without writing every post from scratch
public: true
---

# Build-in-Public Studio — Project Metadata

*Single source of truth for cross-project AI summaries. See [`docs/Ways-of-Working.md`](./docs/Ways-of-Working.md) Part 13 for how this file is consumed.*

---

## What this is

A local web dashboard that pulls your week's GitHub activity and weekly notes, asks Claude to identify 3–5 "story-worthy moments", drafts an X thread and an Indie Hackers long-form post for each, and lets you review, edit, approve, and one-click "Copy + Open" the right platform to publish. Runs entirely on your machine — your data, your API keys, your laptop. The hosted SaaS version is a deliberate Phase 2 if the local tool earns the right.

---

**Phase 1 — Local MVP.** Stages 1–8 complete. The app does its full core job end-to-end: pulls commits + notes, drafts moments via Claude, lets you edit / regenerate / approve / reject / Copy+Open / mark-posted per variant, and lets you star posts that worked so the voice loop learns over time. Notes and moments are project-aware; the dashboard filters by project as pill tabs that turn lime when fully actioned. Stages 9 (scheduler + desktop notifications) and 10 (polish + light-mode toggle) are the remaining feature stages before the Phase 2 OSS launch.

## Current phase

---

## Shipped recently

<!-- Reverse-chronological log. Append new bullets at the top with each user-visible change. Each bullet: YYYY-MM-DD — what shipped. -->

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

**This week:**

- Stage 9 — Scheduler (node-cron, Mondays 9am UK) + desktop notification on completion. "Last run / Next run" indicator in the header (currently shows em-dashes as placeholder).
- Stage 10 — Polish pass: light-mode toggle (next-themes), loading skeletons on the dashboard, better empty states, error-boundary coverage, micro-animations.

**Next week (Phase 2):**

- OSS launch — flip the GitHub repo to public, draft a launch X-thread + IH long-form using the tool itself, post to Indie Hackers + X.

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
