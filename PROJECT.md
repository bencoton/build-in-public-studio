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

**Phase 1 — Local MVP.** Stages 1–6 complete. The dashboard is the real dashboard now — moments grouped, tabs for the two variants, per-variant lifecycle (draft → approved / rejected → posted), per-variant edit and regenerate. Approved variants have a placeholder "Copy + Open" button awaiting Stage 7. Stage 7 next: copy to clipboard + open the platform's new-post page + capture the published URL.

---

## Shipped recently

<!-- Reverse-chronological log. Append new bullets at the top with each user-visible change. Each bullet: YYYY-MM-DD — what shipped. -->

- **2026-05-25** — Stage 6 shipped: real dashboard. Latest generation's moments grouped on the home page, tabs for X thread and Indie Hackers per moment, per-variant edit (inline textarea) / regenerate (single-variant Claude call, ~5–10s) / approve / reject / revert / restore. Approved variants show a disabled "Copy + Open" placeholder ready for Stage 7. Dashboard "Generate" button works the same as the debug page.
- **2026-05-25** — Stage 5 shipped: Claude drafting via `tool_use` for guaranteed structured JSON output. System prompt + tool schema both cached with `cache_control: ephemeral` — second-call savings of ~90% on the cached portion. `/debug/draft` renders the latest generation's moments with both X-thread and Indie-Hackers-long variants. Also: inline note deletion (with confirm), elapsed-seconds counter on the generate button, and a `transaction()` helper in `db.ts` after hitting BIPS-L3 (node:sqlite has no `.transaction()` method).
- **2026-05-25** — Stage 4 shipped: GitHub commit sync via Octokit's `paginate` helper. Last 7 days of commits per watched repo, cached in SQLite, idempotent re-runs thanks to a `(repo, sha)` UNIQUE constraint. Per-repo error handling (a 404 on one repo doesn't abort the whole sync). `/debug/commits` renders the cache with relative timestamps + short SHAs.
- **2026-05-25** — Stage 3 shipped: Settings page with API-key status cards, inline "how to get this key" walk-throughs for Anthropic and GitHub, smoke-test buttons that hit each API for real, watched-repos multi-select fed by the user's GitHub repo list, and schedule + banned-words + style-notes preferences persisting to the `settings` table.
- **2026-05-25** — Stage 2 shipped: SQLite via Node's built-in `node:sqlite` module (no native bindings, no Visual Studio Build Tools dependency). Notes page saves and lists with relative timestamps. Full schema for the whole app created on first boot (notes, watched_repos, commits, moments, drafts, settings).
- **2026-05-25** — Stage 1 shipped: project docs in place, WyCo-branded dashboard renders on localhost:3000, private GitHub repo created at bencoton/build-in-public-studio, first commit pushed.

---

## Up next

**This week:**

- Stage 7 — Copy + Open flow for X and Indie Hackers, with the "Did you publish it?" follow-up that captures the published URL and flips status from approved → posted.
- Stage 8 — `/history` page with star/flop ratings. Starred posts feed back into future draft generations as voice examples.

**Next week:**

- Stage 9 — Scheduler (node-cron, Mondays 9am) + desktop notification on completion. "Last run / Next run" indicator in the header.

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
