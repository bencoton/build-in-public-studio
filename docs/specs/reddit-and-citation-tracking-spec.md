# Feature Spec — Reddit drafting + Citation tracking

*Status: Draft for review. Author: Cowork (planning). Date: 2026-06-20. Hand-off target: Claude Code.*
*Scope: two capabilities — (A) Reddit post generation, (B) the citation tracking post→outcome loop.*
*Companion docs: [implementation plan](./reddit-and-citation-implementation-plan.md) · schema migration `migrations/0004_citation_loop_schema.sql`.*

---

## 0. TL;DR

Two additions to Build-in-Public Studio:

1. **Reddit drafting (Phase 1.5c — before the OSS launch).** Extend the existing moment→draft pipeline with a third platform. For each moment, the user selects one or more target subreddits (r/SaaS, r/indiehackers, r/SideProject, r/microsaas); Claude writes a separately-tailored journey-format draft per sub and surfaces that sub's self-promo rules as an inline checklist so drafts don't trip mod filters. Reuses Copy + Open, edit, regenerate, approve, history, and voice learning unchanged.

2. **Citation tracking (Phase 2.5 — after the OSS launch).** The differentiating loop. Per project, the user defines a set of tracked prompts and a brand/domain string. A scanner runs twice-weekly in a Docker container on the homelab (node `wyco`), asks each prompt to an AI answer engine (Perplexity Sonar first), parses the cited sources, and records whether the brand's **domain was cited** vs **brand was mentioned** — with which URL, engine, prompt, and timestamp — as time-series rows in Neon. Studio then links **generated post → tracked URL → citation earned**, attributing outcomes back to the posts it wrote. Data is explicitly sampled/approximate, never an exact count. No paid social-engagement APIs; a manual paste-in field covers likes/reposts.

Both features honour the existing hard rules: never auto-publish, banned-words list, `[VERIFY]` on uncertain specifics, BYO keys, ask-before-deps, 100% Claude-generated.

---

# Part A — Reddit post generation

## A.1 Problem statement

The tool drafts for X and Indie Hackers, but Reddit is where a large share of the indie-hacker / micro-SaaS audience actually reads launch-and-journey stories — and it's the highest-leverage surface for getting *cited by AI answer engines* (Part B), because Reddit threads are disproportionately represented in LLM training and retrieval. The cost of not covering Reddit: the user hand-writes Reddit posts (defeating the tool's purpose) or skips the channel that most feeds the citation loop. Reddit also punishes off-tone self-promo harder than X or IH — each sub has its own rules, and tripping them means a shadow-removed post and wasted effort.

## A.2 Goals

1. **Add Reddit as a first-class third platform** in the moment→draft flow, reachable from the same dashboard cards as X and IH.
2. **Produce per-subreddit-tailored drafts** in the journey-post format: honest headline, real numbers, what went wrong, one specific insight, no forced CTA — tone adjusted per sub.
3. **Prevent mod-filter trips** by surfacing each sub's self-promo rules as a visible, per-draft checklist the user reviews before copying.
4. **Reuse, don't rebuild** — edit, regenerate, approve/reject, Copy + Open, history, ratings, and voice learning all work for Reddit drafts with no parallel implementation.
5. **Ship before the OSS launch** so the public debut shows three platforms, strengthening the launch story.

## A.3 Non-goals

- **Auto-posting to Reddit.** Out of scope, permanently, per project rule #1 — Copy + Open keeps the human in the loop. Reddit's API would technically allow it; we still won't.
- **Live mod-rule scraping.** We do not crawl each sub's rules at runtime. Rules are a curated, versioned config in the repo (subs change rules rarely; a stale-rule risk is acceptable and cheaper than a scraper). Revisited only if rules drift enough to matter.
- **Comment/replies drafting.** Only top-level posts. Reply-drafting is a separate future idea.
- **Arbitrary subreddits.** v1 ships the four named subs as a curated set. A free-text "other sub" is a P2.
- **Per-sub flair/tag automation.** We surface flair guidance as text; we don't pre-select flair.

## A.4 User stories

- As an indie hacker, I want to pick which subreddits a given moment should target, so that I only generate drafts for communities where the story fits.
- As an indie hacker, I want each subreddit's draft tailored to that community's tone, so that a r/SaaS post reads differently from a r/SideProject post.
- As a careful poster, I want to see the chosen sub's self-promo rules next to the draft, so that I can confirm the post won't get auto-removed before I paste it.
- As a returning user, I want Reddit drafts to behave exactly like my X and IH drafts (edit, regenerate, approve, copy, rate), so that I don't learn a new workflow.
- As a voice-conscious writer, I want my starred Reddit posts to feed future Reddit drafts, so that the tool learns my Reddit voice the way it already learns my X/IH voice.
- *(Edge)* As a user, I want a clear empty/neutral state when a moment has no Reddit draft yet, so that "not generated" is visually distinct from "failed".

## A.5 Requirements

### P0 — Must-have

| # | Requirement | Acceptance criteria |
|---|---|---|
| A0.1 | New `reddit` draft variant with a target subreddit | Given a generated moment, when the user requests Reddit drafts for selected sub(s), then one `drafts` row per selected sub is created with `variant = 'reddit'` and a populated `subreddit` value. |
| A0.2 | Per-sub tailored generation | Given two subs selected for one moment, when generation runs, then the two drafts differ in tone/framing appropriate to each sub (not the same text with a different label). |
| A0.3 | Journey-post format enforced in the prompt | Drafts contain an honest headline, at least one real number drawn from source material (or a `[VERIFY]` placeholder), a "what went wrong" beat, one specific insight, and no forced CTA. |
| A0.4 | Self-promo rules checklist per draft | Given a Reddit draft for sub X, when it renders, then the curated rule summary + a pre-post checklist for sub X appears beside it. |
| A0.5 | Banned-words + `[VERIFY]` rules apply | Reddit drafts obey the system-prompt banned-words list (plus user additions) and mark uncertain specifics with `[VERIFY]`, identical to X/IH. |
| A0.6 | Copy + Open to the correct sub | Given an approved Reddit draft for sub X, when the user clicks Copy + Open, then the text is copied and the sub's submit page (`https://www.reddit.com/r/<sub>/submit`) opens; the "Did you publish it?" URL-capture flow runs as for X/IH. |
| A0.7 | Lifecycle + history parity | Reddit drafts support draft→approved→posted / rejected, ratings (star/neutral/flop), and appear in `/history` with a platform filter that now includes Reddit. |

### P1 — Should-have (fast follow)

| # | Requirement | Notes |
|---|---|---|
| A1.1 | Reddit drafts feed voice learning | Sample starred Reddit drafts into future Reddit generation, mirroring the X/IH loop. Filter examples by variant so Reddit learns from Reddit. |
| A1.2 | Per-sub default selection in Settings | A setting for "default subs to target" so the user isn't re-picking every time. |
| A1.3 | Title vs body split | Reddit posts are title + self-text. Store/display them as distinct fields rather than one blob, so Copy + Open can populate both. |

### P2 — Future considerations (design for, don't build)

- Free-text custom subreddit (with a manual rules-notes field).
- Comment/reply drafting.
- Cross-posting helper (one moment → staggered posts across subs over days, reusing the Phase 1.5b scheduler).

## A.6 Data model (Part A)

Smallest change that supports per-sub drafts (full SQL in the migration file):

- **`drafts.variant`** CHECK constraint extended: `('x_thread', 'ih_long', 'reddit')`.
- **`drafts.subreddit`** — new nullable `text` column. NULL for x_thread/ih_long; one of the curated sub slugs for `reddit` rows. A CHECK enforces `subreddit IS NOT NULL` when `variant = 'reddit'` and `NULL` otherwise.
- *(P1.3, optional now)* **`drafts.title`** — new nullable `text` column for Reddit's post title, separate from the self-text in `content`. Including it now is cheap and avoids a later migration; flagged as an open question below.

Subreddit rules live as a **versioned config in the repo** (`src/lib/reddit-subs.ts`), not in the DB — they're code, reviewed in PRs, and apply to all users. Shape per sub: `{ slug, displayName, toneNote, selfPromoRule, prePostChecklist[], flairHint }`.

## A.7 Success metrics (Part A)

- **Leading:** Reddit drafts generated per week; % of generated Reddit drafts approved (target ≥ same approval rate as X/IH within 2 weeks of use); % of Reddit posts the user actually marks "posted".
- **Lagging:** Reddit posts later appear as cited URLs in Part B (the two features compound); reduction in hand-written Reddit posts to ~zero.

---

# Part B — Citation tracking (the post→outcome loop)

## B.1 Problem statement

Build-in-public posts are written on faith — you ship a story and never learn whether it moved anything. The emerging, measurable outcome that *matters for a dev tool* is being **cited by AI answer engines**: when someone asks Perplexity/ChatGPT "best build-in-public tools", does your domain show up in the sources? Today there's no cheap way to know, and no way to connect a specific post you wrote to a citation you later earned. Studio is uniquely positioned to close that loop because it already knows which URLs it generated posts for. The cost of not building it: Studio stays a "content factory" with no feedback signal, and misses its sharpest differentiator versus commit-driven competitors.

## B.2 Goals

1. **Measure AI-citation presence per project** across a user-defined prompt set, recording domain-cited vs brand-mentioned, with source URL, engine, prompt, and timestamp as time-series.
2. **Run cheaply and reliably off-serverless** — twice-weekly scans in a homelab Docker container, Perplexity-first (~pennies/user/month).
3. **Attribute outcomes to posts** — link generated post → the tracked URL it promoted → citations earned for that URL/domain, so Studio can say "this post is associated with citations appearing after it shipped".
4. **Be honest about precision** — present all citation data as sampled/approximate, never an exact count, everywhere it surfaces.
5. **Stay BYOK and engine-extensible** — Perplexity Sonar first; Gemini grounding + OpenAI web-search as later adapters behind a common interface.

## B.3 Non-goals

- **Social engagement metrics via platform APIs.** Explicitly out. X charges ~$200/mo for data users already see free; not worth it. A **manual paste-in field** for likes/reposts/comments is the sanctioned alternative.
- **Google AI Overviews.** No API; would need paid SERP scraping. Skipped.
- **Real-time / on-demand scanning at scale.** Scans are scheduled (twice weekly) plus a manual "run now" for one project. We are not building a high-frequency rank-tracker.
- **Exact citation counts or guaranteed coverage.** Engines are non-deterministic; results are a sample. We never imply completeness.
- **Auto-publishing or auto-optimising posts based on citations.** The loop is measurement + attribution, not an autonomous SEO agent.
- **Hosting other users' API keys for them / metered billing.** BYOK only at this stage (multi-user/billing is the separate Phase 4 question).

## B.4 Architecture overview

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│  Studio (Vercel + Neon)  │        │  Homelab node: wyco (Docker)  │
│                          │         │                              │
│  /citations UI (read)    │         │  citation-scanner container   │
│  Settings: prompts,      │  Neon   │  cron: twice-weekly           │
│  brand/domain, BYO keys  │◀──────▶│  1. read tracked_prompts +    │
│  (encrypted in Neon)     │  (SQL)  │     decrypt BYO keys          │
│                          │         │  2. call engine adapter(s)    │
│  Attribution view:       │         │  3. parse sources → matcher   │
│  post → URL → citations  │         │  4. write citation_results    │
└─────────────────────────┘         └──────────────────────────────┘
```

- **Why off-serverless:** scans are slow, bursty, and run third-party LLM calls per prompt — a poor fit for Vercel function limits and a good fit for the homelab. The container connects directly to the same Neon DB.
- **The Studio app never runs scans.** It only reads/writes config and reads results. This keeps the Vercel side within Hobby limits and the scan workload on hardware the user already owns.
- **Engine adapters** implement one interface: `query(prompt, opts) → { answerText, sources: [{url, title}], engine, raw }`. Perplexity Sonar is the only adapter in the MVP; Gemini/OpenAI are P2 adapters behind the same shape.

## B.5 The matcher (what counts as a citation vs a mention)

For each engine response to a tracked prompt, for the project's `brand_domain` and `brand_name`:

- **Citation** = the brand's **domain** (or a configured subdomain/path) appears in the parsed **sources** list. This is the strong signal. Records the exact matched `source_url`.
- **Mention** = the **brand name string** appears in the answer **text** but the domain is *not* in sources. Weaker signal — the model named you without citing you.
- **Neither** = recorded too (absence is data — it's how trend lines show movement).

Each scan of one prompt against one engine produces exactly one `citation_results` row capturing: `cited` (bool), `mentioned` (bool), `matched_url` (nullable), `engine`, `prompt_id`, `answer_excerpt`, `sources` (jsonb, full parsed list for audit), `scanned_at`. Storing the full sources list lets us re-run the matcher later without re-querying.

**Precision caveat baked in:** every results surface shows a "sampled — not an exact count" note, and trends are framed as "citation rate across N scans", never "you were cited X times".

## B.6 Attribution: post → URL → citation

This is the differentiator and needs an explicit, defensible definition (it's correlational, not causal — say so in the UI):

1. Each generated draft can be associated with a **tracked URL** (the link the post promotes — typically the project's domain or a specific page). When the user marks a draft "posted" and captures its `posted_url`, they can also tag the **promoted URL** it drives traffic/citations to.
2. A tracked prompt belongs to a project and targets a `brand_domain`.
3. **Attribution = ** for a posted draft promoting URL U on date D, surface the citation_results for that project's domain/U where `cited = true` and `scanned_at > D`, plus the before/after citation rate around D.
4. The UI states this as *"posts associated with citation lift"* — a correlation in a small sample, never a causal claim. This honesty is on-brand (the beginner-learning angle) and legally safer.

## B.7 User stories

- As a solo dev, I want to define the prompts I care about per project (e.g. "best build-in-public tools", "how to track AI citations"), so that scans reflect what my buyers actually ask.
- As a solo dev, I want to set my brand name and domain per project, so that the matcher knows what to look for.
- As a privacy-minded user, I want to supply my own Perplexity key and have it stored encrypted, so that my key isn't sitting in plaintext.
- As a homelab owner, I want the scanner to run twice weekly in Docker on `wyco` without me touching it, so that the data accrues on its own.
- As a builder, I want to see, per project, the citation rate trend over time and the latest sources, so that I can tell if I'm gaining ground.
- As a content strategist, I want to see which of my posts are associated with citations earned afterward, so that I learn what kind of post earns AI mentions.
- As an honest operator, I want every number labelled "sampled/approximate", so that I don't fool myself or my audience.
- As a user who still cares about engagement, I want to paste in likes/reposts manually, so that I have that context without paying $200/mo for an API.

## B.8 Requirements

### P0 — Must-have (MVP = the user's own use)

| # | Requirement | Acceptance criteria |
|---|---|---|
| B0.1 | Per-project tracked-prompt set | Given a project, when the user adds/edits/removes prompts, then they persist in `tracked_prompts` scoped to that repo and are picked up by the next scan. |
| B0.2 | Per-project brand/domain match config | Given a project, when the user sets `brand_name` and `brand_domain`, then the matcher uses them; both are required before a scan runs for that project. |
| B0.3 | BYOK, encrypted in Neon | Given the user enters a Perplexity key in Settings, when it's saved, then it's stored encrypted (not plaintext) and is decryptable only with the env-held `ENCRYPTION_KEY` shared by the app and the scanner container. |
| B0.4 | Perplexity Sonar engine adapter | Given a tracked prompt, when the scanner queries Sonar, then it returns answer text + native citations parsed into the common `sources` shape. |
| B0.5 | Matcher records cited vs mentioned | For each (prompt × engine) scan, exactly one `citation_results` row is written with `cited`, `mentioned`, `matched_url`, `engine`, `prompt_id`, `sources` jsonb, `scanned_at`. |
| B0.6 | Twice-weekly Docker scan on `wyco` | Given the container is deployed, when the cron fires (twice weekly), then it scans every project with prompts + brand config + a usable key, and writes results. A run is idempotent per (prompt, engine, scan window) — a re-run inside the same window doesn't double-count. |
| B0.7 | `/citations` read UI in Studio | Given results exist, when the user opens `/citations` and picks a project, then they see the citation-rate trend, latest sources, and per-prompt latest status — all labelled "sampled/approximate". |
| B0.8 | Honesty labelling | Every citation figure in the UI carries the sampled/approximate caveat; no surface implies an exact or complete count. |
| B0.9 | Manual engagement paste-in | Given a posted draft, when the user pastes engagement numbers into the manual field, then they persist and display alongside that post. No platform API is called. |

### P1 — Should-have

| # | Requirement | Notes |
|---|---|---|
| B1.1 | Post→URL→citation attribution view | The differentiator UI (B.6). P0 stores the linkage data; P1 is the polished before/after view. Ship the data model in P0 so this is purely additive. |
| B1.2 | "Run scan now" for one project | Manual trigger that hits the same scanner logic (e.g. a gated endpoint the container or a local script can call), for when the user doesn't want to wait for the cron. |
| B1.3 | Scan run log / health | A small `scan_runs` record (started/finished/counts/errors) so a silent scanner failure is visible, per the WoW "surface silent failures" habit. |

### P2 — Future considerations (design for, don't build)

- **Gemini grounding + OpenAI web-search adapters** behind the existing engine interface (free/cheap tiers; additive rows differentiated by `engine`).
- Multi-user key storage + metered usage (folds into Phase 4 SaaS).
- Alerting (notify when citation rate changes materially) — reuses the notification idea but is not in scope now.
- Competitor-domain tracking (track *their* citation rate on the same prompts).

## B.9 Data model (Part B)

Three new tables + reuse of `drafts` for attribution. Full DDL in `migrations/0004_citation_loop_schema.sql`. Summary:

- **`tracked_prompts`** — `{ id, repo, prompt_text, active, created_at, updated_at }`. The prompts per project.
- **`citation_results`** — time-series. `{ id, prompt_id (FK→tracked_prompts ON DELETE CASCADE), repo, engine, cited bool, mentioned bool, matched_url, answer_excerpt, sources jsonb, scan_run_id, scanned_at }`. One row per (prompt × engine × scan).
- **`scan_runs`** *(supports B1.3, cheap to include now)* — `{ id, started_at, finished_at, status, prompts_scanned, results_written, error }`.
- **Brand match config + BYO keys** — stored in the existing `settings` table as namespaced keys (e.g. `citation.brand_name.<repo>`, `citation.brand_domain.<repo>`, `apikey.perplexity` encrypted), avoiding new tables for single-value config. *(Alternative: a typed `project_settings` table — see open questions.)*
- **Attribution linkage** — two new nullable columns on `drafts`: `promoted_url text` (the URL this post drives toward) and `engagement_manual jsonb` (the paste-in likes/reposts). Citations are then joined at query time via `repo` + `promoted_url`/`brand_domain` + `scanned_at > posted_at`.

## B.10 Success metrics (Part B)

- **Leading:** scans complete on schedule (≥ 95% of scheduled runs write results); # projects with active prompts; citation-rate data points accruing per week.
- **Lagging:** the user can point to ≥ 1 post associated with a citation earned afterward (proof the loop works); citation rate trend is legible enough to inform what to write next; this becomes a launch/marketing hook ("the tool that tells you which posts got you cited by AI").

---

## C. Cross-cutting: rules, security, dependencies

- **Hard rules honoured:** no auto-publish (A), Copy + Open only; banned words + `[VERIFY]` in all drafts; BYOK; 100% Claude-generated (state it in the `/citations` and Reddit UI copy where natural); update `PROJECT.md` "Shipped recently" + `docs/PLAN.md` in the same commit when each phase ships.
- **Secrets:** BYO keys encrypted at rest in Neon; the only new env secret is `ENCRYPTION_KEY`, set identically in `.env.local`, Vercel (Sensitive), and the homelab container — same fail-closed discipline as `CRON_SECRET`. No keys in code or commits.
- **Dependencies (ask-first, per rule #8):** the scanner needs an HTTP client (native `fetch` in Node 20+ — no dep) and a crypto routine for key encryption (`node:crypto` AES-256-GCM — built-in, **no dep**, consistent with lesson BIPS-L2's "prefer Node built-ins"). **Recommendation: zero new npm dependencies.** The Perplexity adapter is a plain `fetch`. Flag for explicit approval before adding anything (e.g. if a future engine SDK is wanted).
- **Webpack-safety (BIPS-L5):** all scanner code lives in the standalone Docker container, **not** in the Next.js bundle, so node-only modules can't poison the webpack build. The Studio app only does plain SQL reads/writes.
- **Neon serialization (BIPS-L4):** any citation rows passed from a Server Component to a Client Component must be spread into plain objects in the data-access helper.

## D. Open questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| D1 | Add `drafts.title` now (Reddit title/body split, P1.3) or defer to a later migration? Including now is one cheap column and avoids a second migration. **Recommendation: include now.** | Ben | No — recommend include |
| D2 | Brand/BYO-key config in the existing `settings` table (namespaced keys) vs a new typed `project_settings` table? Settings table is faster; a typed table is cleaner for multi-user later. **Recommendation: settings table for MVP, note the migration path.** | Ben / eng | No |
| D3 | Encryption approach for BYO keys — `node:crypto` AES-256-GCM with a single `ENCRYPTION_KEY`. Confirm key rotation story (re-encrypt on rotate). | Ben | Yes for B0.3 |
| D4 | Exact Perplexity Sonar request/response shape — must run the pre-flight API-shape audit (WoW L12) against a real Sonar call before building the parser. Don't design the matcher on assumptions. | eng (Code) | Yes for B0.4 |
| D5 | Scan idempotency window — define "scan window" precisely (e.g. one row per prompt/engine per calendar day) so re-runs don't double-count (B0.6). | eng | Yes for B0.6 |
| D6 | Reddit per-sub generation cost — N subs = N extra Claude calls per moment. Cap selectable subs per moment (e.g. ≤ 3) to bound token spend? | Ben | No |
| D7 | Does Reddit drafting reuse the two-phase `identifyMoments`→`draftMoment` pipeline, adding reddit to the per-moment draft call, or a separate pass? **Recommendation: extend the per-moment draft call** (see impl plan). | eng | No |

## E. Timeline / phasing

- **Phase 1.5c — Reddit drafting.** Before OSS launch. ~1–2 Code sessions. Sequenced after the current Stage 10 polish, before flipping the repo public, so the launch shows three platforms.
- **Phase 2 — OSS launch.** Unchanged (existing plan).
- **Phase 2.5 — Citation tracking.** After launch. Build order: schema migration → BYOK encrypted settings + brand config → Perplexity adapter + matcher (with pre-flight API audit) → Docker scanner + cron on `wyco` → `/citations` read UI → attribution view (B1.1) → manual engagement field. ~3–5 Code sessions. Gemini/OpenAI adapters are P2 follow-ups.

See the [implementation plan](./reddit-and-citation-implementation-plan.md) for file-by-file steps and ready-to-paste Code prompts.
