---
project: build-in-public-studio
display_name: Build-in-Public Studio
tagline: Turn your week's commits and notes into ready-to-ship X threads and IH posts.
status: scaffolding
accent_color: teal
github: https://github.com/bencoton/build-in-public-studio
deploy_url:
started: 2026-05-24
last_updated: 2026-05-24
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

**Phase 0 — Scaffolding.** Goal: the dashboard renders, the docs are in place, the GitHub repo exists, and the deploy pipeline (local `npm run dev`) is green before any feature code goes near `better-sqlite3` or the Anthropic SDK.

---

## Shipped recently

<!-- Reverse-chronological log. Append new bullets at the top with each user-visible change. Each bullet: YYYY-MM-DD — what shipped. -->

- (nothing yet — first commit pending)

---

## Up next

**This week:**

- Stage 1 — docs + WyCo-branded scaffold, first commit pushed to a private repo.
- Stage 2 — SQLite schema (drafts, notes, repos, settings, ratings) and the /notes page (textarea + recent-notes list, markdown supported).

**Next week:**

- Stage 3 — Settings page, with step-by-step walk-throughs for getting the Anthropic key and the GitHub fine-grained token.

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
