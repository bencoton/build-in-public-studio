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

**Phase 1 — Local MVP.** Stage 1 complete (scaffold + docs + WyCo brand + first commit pushed). Starting Stage 2 next: SQLite schema and the `/notes` page.

---

## Shipped recently

<!-- Reverse-chronological log. Append new bullets at the top with each user-visible change. Each bullet: YYYY-MM-DD — what shipped. -->

- **2026-05-25** — Stage 1 shipped: project docs in place, WyCo-branded dashboard renders on localhost:3000, private GitHub repo created at bencoton/build-in-public-studio, first commit pushed.

---

## Up next

**This week:**

- Stage 2 — SQLite schema (drafts, notes, repos, settings, ratings) and the /notes page (textarea + recent-notes list, markdown supported).
- Stage 3 — Settings page, with step-by-step walk-throughs for getting the Anthropic key and the GitHub fine-grained token.

**Next week:**

- Stage 4 — GitHub sync via Octokit. Watched repos in Settings; commits pulled and displayed raw on a debug page.

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
