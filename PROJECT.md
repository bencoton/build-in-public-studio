---
project: build-in-public-studio
display_name: Build-in-Public Studio
tagline: Turn your week's commits and notes into ready-to-ship X threads and IH posts.
status: scaffolding
accent_color: teal
github: https://github.com/bencoton/build-in-public-studio
deploy_url: https://build-in-public-studio.vercel.app
started: 2026-05-24
last_updated: 2026-06-20
audience: solo devs and indie hackers shipping in public who want a weekly rhythm without writing every post from scratch
public: true
# Portfolio Dashboard — auto-read by ../portfolio-dashboard/scripts/build-projects.mjs (run `npm run sync`)
stage: iteration                # discovery|planning|design|development|testing|deployment|monitoring|iteration
dashboard_status: active        # active|paused|exploring|backburner|shipped
summary: "Turns your week's git commits and notes into ready-to-ship build-in-public posts (X threads, Indie Hackers) with Claude — copy-and-post, human stays in the loop."
wow_alignment: "Aligned — migrated to Neon; Doppler secrets; Vercel Cron drives weekly generation."
live_url: https://build-in-public-studio.vercel.app
vercel_url: https://vercel.com/dashboard
neon_url: https://console.neon.tech
---

# Build-in-Public Studio — Project Metadata

*Single source of truth for cross-project AI summaries — the rolling log of what's shipped, the current phase, and what's next.*

---

## What this is

A local web dashboard that pulls your week's GitHub activity and weekly notes, asks Claude to identify 3–5 "story-worthy moments", drafts an X thread and an Indie Hackers long-form post for each, and lets you review, edit, approve, and one-click "Copy + Open" the right platform to publish. Runs entirely on your machine — your data, your API keys, your laptop. The hosted SaaS version is a deliberate Phase 2 if the local tool earns the right.

---

## Current phase

**Phase 1.5c — Reddit drafting: complete (2026-06-20).** Reddit is now a first-class third platform in the moment→draft flow (per-sub tailored journey drafts, pre-post checklists, Copy + Open to each sub, history + voice-learning parity). Schema migration `0004` Part A is applied to Neon; Part B (citation tracking, Phase 2.5) is intentionally deferred until after the OSS launch. **Next up: Phase 2 — OSS launch** (flip the repo public, polish the README, draft the launch posts with the tool itself, rotate secrets). The earlier phases below remain accurate context.

**Phase 1b — Tech stack migration: complete.** Stages 9b.1 → 9b.4 shipped. App lives on Vercel against Neon Postgres via the `postgres.js` client (transaction-mode pooler, `prepare: false`). Weekly generation is triggered by **Vercel Cron** firing `/api/cron/generate` every Monday at 08:00 UTC (= 09:00 UK during BST), gated by a `CRON_SECRET` Bearer header. The dashboard's manual "Generate now" button calls the same `generateDrafts()` pipeline, so cron-triggered and manual runs are interchangeable. Supabase config retired, `supabase/` folder removed from the repo (a one-time backup of schema + RPC functions + JSON data dumps lives in `migration-backups/build-in-public-studio/`). **Next up: Stage 10 polish** (light-mode toggle, loading skeletons, error boundaries, SDK upgrade to remove type-lag casts), then Phase 1.5 features.

---

## Shipped recently

<!-- Reverse-chronological log. Append new bullets at the top with each user-visible change. Each bullet: YYYY-MM-DD — what shipped. -->

- **2026-06-21** — **Reddit drafts now live in their own tab.** Each moment card's tabs are X thread → Reddit → Indie Hackers; the Reddit tab holds the sub picker + per-sub drafts. Previously Reddit rendered *below* the tabs and read as part of the active (X) post and was easy to miss. On-demand generation is unchanged.
- **2026-06-20** — **Phase 1.5c shipped: Reddit drafting (third platform).** Each moment card now has a Reddit section: pick up to 3 target subreddits (r/SaaS, r/indiehackers, r/SideProject, r/microsaas) and generate a separately-tailored journey-format draft per sub. Each draft shows its title (with copy button), the sub's pre-post self-promo checklist (so drafts don't trip mod filters), and the same edit / regenerate / approve / reject / Copy + Open flow as X and IH — Copy + Open targets that sub's `…/submit` page. Reddit drafts flow through `/history` (platform filter now includes Reddit) and voice learning (starred Reddit drafts feed future Reddit generation). Subreddit tone + rules live as a versioned config in `src/lib/reddit-subs.ts` — no runtime scraping. New `submit_reddit_draft` tool + `draftRedditForSub()` / `generateRedditDrafts()` in `claude.ts` (one Claude call per moment×sub, parallel, reusing the cached system prompt). Schema: migration `0004` Part A — `drafts.variant` gains `reddit`, plus new `subreddit` (curated-slug CHECK + variant↔subreddit consistency CHECK) and `title` columns. Never auto-posts — Copy + Open only. No new npm dependency.
- **2026-06-14** — **Scheduled page + generate UI polish.** Moved "Scheduled for the next 7 days" off the dashboard into a dedicated `/scheduled` page (60-day window, empty state, loading skeleton). Added "Scheduled" to the sidebar nav between Dashboard and Batch. Repos with no commits in the generate panel now show a neutral muted style instead of a red error indicator — no commits is a valid result, not a failure.
- **2026-06-14** — **Per-repo Generate architecture.** The dashboard's "Generate now" button now fires one server action call per watched repo (sync GitHub → generate for that repo), instead of one monolithic call that was hitting Vercel Hobby's 60s limit. Each call comfortably fits in ~50s max. The Vercel Cron endpoint mirrors the same pattern for consistency. New `syncOneRepo(fullName)` public entry point in `github-sync.ts` (creates its own Octokit instance; internal `syncSingleRepo` helper refactored for shared use). New `generateForRepoAction(repo)` server action in `dashboard-actions.ts`. Fixed note-filter bug in `claude.ts`: unlinked notes (`repo = null`) are now included in every repo's generation pass instead of being dropped. The Generate panel shows per-repo progress rows with sync → draft status in real time. Removed diagnostic `/api/health` route (confirmed DB healthy).

- **2026-05-28** — Phase 2.5 shipped: **two-phase generation, Hobby-tier compatible**. Refactored `generateDrafts()` in `src/lib/claude.ts` from one monolithic Claude call into two phases — `identifyMoments()` returns moment summaries + source refs (small structured output, ~15s), then `draftMoment()` runs N parallel Claude calls, one per identified moment, each ~10-15s. Wall-clock budget drops from ~95s (Sonnet single-call) to ~35-45s (parallel two-phase). Each draft call sees only the source material referenced by its moment, not the full window. New tool schemas: `submit_moments` (Phase 1) and `submit_moment_drafts` (Phase 2). Same `DRAFT_SYSTEM_PROMPT` cached on every call; Phase 1 writes the cache, Phase 2 parallel calls all read from it. `generateDrafts()` public signature unchanged — every caller (cron route, dashboard action, batch action) works without modification. `maxDuration` brought back down from 300 → 60 on `api/cron/generate/route.ts`, `app/page.tsx`, `app/batch/page.tsx`, `app/summaries/page.tsx`. **Self-hosters no longer need Vercel Pro** (£20/month saved). README cost section + architecture diagram updated; tech-stack line now reads "Works on Vercel Hobby (free)". Anthropic spend goes up ~30% per fire (more cache writes) but absolute cost stays under £35/year for heavy personal use.
- **2026-05-28** — Pre-launch cleanup: Doppler adopted as the secret manager for this project (via the Vercel-Doppler integration — no in-repo changes, secrets sync directly into Vercel env vars). Removed `scripts/backup-data.mjs` (dead Supabase-era backup script, imported a package no longer in deps) and `src/types/database.ts` (orphaned Supabase-generated wrapper, `Json` type had zero consumers). Five stale "Supabase" / "SQLite" comments fixed across `claude.ts`, `claude-regenerate.ts`, `format.ts`, and `github-sync.ts` to reference the actual stack (Postgres via postgres.js). Cosmetic but matters for first-time visitors reading the source post-OSS-launch. README + LICENSE landed earlier the same day in preparation for Phase 2 launch.
- **2026-05-27** — Phase 1.5a shipped: per-project product summaries. New `/summaries` page with a project picker (pill tabs over watched repos, URL-driven via `?repo=owner/name`). Two generation modes per project: **Website summary** — Claude returns a structured `{ tagline, intro, features[] }` payload (own tool schema, JSON-encoded into the `content` column), rendered as a hero + intro paragraphs + bulleted features list with inline edit (per-field) and Copy-all. **Launch announcement** — Claude returns `{ x_thread, ih_long }` (one call, two `summaries` rows inserted atomically) and is displayed in a two-tab card with per-variant Edit/Copy/Open-platform buttons (links to X compose + Indie Hackers new-post). Regenerate replaces by inserting a new row, leaving the prior version in the table (history view to come if needed). Reuses the cached `DRAFT_SYSTEM_PROMPT` so voice rules stay consistent; pulls the project's full commit + note history (not the 7-day window) as context. `maxDuration = 300` on the summaries page for the Pro-tier server-action timeouts. Sidebar gains a "Summaries" nav item.
- **2026-05-27** — Phase 1.5b shipped: batch generation + scheduled drafts. New `/batch` page with configurable look-back window (30/60/90/180 days), moment-count slider (5–15), start-date picker, and project filter. Generation runs through the same `generateDrafts()` pipeline, now refactored to accept `GenerateDraftsOptions` ({ windowDays, maxMoments, repoFilter, scheduling, maxOutputTokens }) — the weekly cron path still calls it with defaults. New `src/lib/scheduling.ts` exports `stagger(startDate, count)` which produces N alternating Mon/Thu timestamps at 09:00 Europe/London; auto-assigned to drafts at insert time when batch scheduling is requested. Each draft has an editable `scheduled_for` widget (new `ScheduledDateEditor` client component) on its dashboard card. New `ScheduledSection` on the dashboard surfaces drafts due in the next 7 days via a live query against `getScheduledDrafts(7)` — no background cron needed. New `updateDraftScheduledForAction` in `dashboard-actions.ts`. `maxDuration = 300` added to the dashboard and batch pages so server-action-driven generations don't timeout on cold containers. Sidebar gains a "Batch" nav item between Dashboard and History.
- **2026-05-27** — Cron cadence doubled: Vercel Cron now fires Mon + Thu at 08:00 UTC (= 09:00 UK during BST), up from Mondays only. `vercel.json` schedule changed to `0 8 * * 1,4`; `DEFAULT_SCHEDULE_CRON` in `settings.ts` matched to `0 9 * * 1,4` so the AppHeader "Next run" countdown stays accurate. Copy updates across `app-header.tsx`, `preferences-form.tsx`, the cron route's docstring, and CLAUDE.md hard rule #7.
- **2026-05-27** — Stage 10.4 shipped: light-mode toggle via `next-themes`. Sun/moon button in the AppHeader; hydration-safe `mounted` gate so the server placeholder matches the client render. Root layout rewired: hardcoded `<html className="dark">` removed, body content wrapped in a `ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}`, `disableTransitionOnChange`). Light-mode token tweak in `globals.css` — page background dropped from pure white to slate-50 so the white cards visibly lift off the page (Linear / Vercel / Stripe pattern); borders nudged a touch darker for clearer card edges; secondary / muted / accent stepped to slate-100 to retain contrast against the new background. Dark mode unchanged. Also fixed the React 19 migration that came with Next 16: `useFormState` is now `useActionState` (moved from `react-dom` to `react`) — three files updated (`note-form.tsx`, `preferences-form.tsx`, `watched-repos-section.tsx`). Piggyback: stale "cron job ships in Stage 9" copy in the schedule field's help text rewritten to reference the live Vercel Cron path.
- **2026-05-27** — Stage 10.3 shipped: `@anthropic-ai/sdk` bumped from `^0.30.1` → `^0.99.0`. Removed four `as any` casts on `cache_control` (two in `claude.ts`, two in `claude-regenerate.ts`) and two local `Usage` widenings for `cache_read_input_tokens` / `cache_creation_input_tokens` — the SDK now properly types both. Replaced top-level `as const` on the tool definitions with a targeted `type: "object" as const` on each `input_schema.type` field (broad `as const` made `input_schema.required` a readonly tuple that didn't fit the SDK's mutable `string[]`). Also documented that Next.js is on 16.2.6, not 14.x — Vercel has been deploying on Next 16 since the bump landed; the cron test on Stage 9b.4 already ran successfully on it. CLAUDE.md stack line updated.
- **2026-05-27** — Stage 10.2 shipped: loading skeletons across all routes via a new `Skeleton` primitive in `src/components/ui/skeleton.tsx` (Tailwind `animate-pulse`, no new deps). One `loading.tsx` per route — dashboard, history, notes, settings, debug/commits, debug/draft — each shaped to roughly match its page so the swap from skeleton to real content doesn't reflow. Tiny piggyback: the stale "Everything else is stored in Supabase" line in `src/app/settings/page.tsx` corrected to Postgres.
- **2026-05-27** — Stage 10.1 shipped: error boundaries. `src/app/error.tsx` renders a friendly "Something went wrong" card with the error message, a Try Again button (calls `reset()`), and a link back to the dashboard. `src/app/global-error.tsx` is the last-resort boundary that catches errors thrown in the root layout itself; uses inline styles only so it renders even if Tailwind / the font pipeline is the thing that broke. Both surface `error.digest` for Vercel log correlation.
- **2026-05-26** — Stage 9b.4 shipped: Vercel Cron wired up for the Monday-9am weekly generation. New `vercel.json` with `crons: [{ path: "/api/cron/generate", schedule: "0 8 * * 1" }]` (Monday 08:00 UTC = 09:00 UK during BST). New `src/app/api/cron/generate/route.ts` — Node runtime, 60s `maxDuration` (hobby-tier cap), `force-dynamic`, verifies `Authorization: Bearer ${CRON_SECRET}` and returns 401 on mismatch / 500 if the env var isn't set on the server (fail-closed). On success it calls `generateDrafts()`, bumps `last_run_at`, and `revalidatePath("/")` so the dashboard picks up the new moments without a manual refresh. `CRON_SECRET` added to `.env.local.example` with a PowerShell one-liner to generate one. Five stale "Stage 9 scheduler" comments updated to reference the live Vercel Cron path. No dead Stage 9 files to delete — `instrumentation.ts`, `lib/scheduler.ts`, and the related `next.config.mjs` flags were all already removed in the 9b pivot.
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

**Next session:**

1. **Phase 2** — OSS launch. Flip the GitHub repo to public, polish the README with screenshots, **draft the launch posts using the tool itself** (the credibility loop), post to Indie Hackers + X. Rotate `CRON_SECRET`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, and `DATABASE_URL` before flipping the repo public.

**After Phase 2 (conditional on launch signals):**

2. **Phase 3** — Multi-AI transcript ingest. Adapters for Claude Code (3a), Aider + Cline (3b), Cursor (3c), and manual ChatGPT/Claude.ai export ingest (3d). Reframes the product from "commits + notes" to "your full AI-assisted work surface" — explicitly targets vibe coders whose substrate is conversations more than diffs. See `docs/PLAN.md` Phase 3 for full architecture (adapter pattern + `ai_sessions` Neon table + local push-sync script + privacy gating). Conditional on Phase 2 generating interest from vibe coders specifically.
3. **Phase 4** — Hosted SaaS at £20/year, BYO keys. Only pursued if Phase 2 + 3 surface users who want hosting rather than self-hosting.

**Phase 2 (later):**

- OSS launch — flip the GitHub repo to public, polish the README with screenshots, **draft the launch posts using the tool itself**, post to Indie Hackers + X. Rotate `CRON_SECRET`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, and `DATABASE_URL` before flipping the repo public, since anything that's been on the dev machine through copy-paste is treated as potentially compromised.

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

---

## Dashboard (portfolio command deck)

*Auto-read by the WyCo Portfolio Dashboard (`scripts/build-projects.mjs` → `projects.js`). The scalar fields — status, summary, WoW note, **stage**, and service links — live in this file's **frontmatter** (above); the phase roadmap + outstanding tests below are parsed from here. Run `npm run sync` in `portfolio-dashboard` (or let the Sunday sweep refresh it). Never hand-edit the dashboard.*

- **phases** (exactly one `current`):
  1. [done] Scaffolding — Project + deploy baseline.
  2. [done] Local MVP — Draft posts from local activity.
  3. [done] Tech-stack migration — SQLite → Supabase → Neon; Next 16.
  4. [done] Summaries / batch / scheduling — Batch drafts + Vercel Cron.
  5. [done] Polish pass — Light theme + UI polish before OSS.
  6. [done] Reddit drafting — Per-sub Reddit as a third platform.
  7. [current] OSS launch — Flip the repo public.
  8. [todo] Multi-AI transcript ingest — Ingest other AI chat logs.
  9. [todo] Hosted SaaS — Multi-user hosted version.
- **outstanding_tests:** none
