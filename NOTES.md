# Session log

Append-only. Newest entry at the top.

---

## 2026-06-25 — Humanizer Phase 1 (P0): `humanize()` module + tell scanner

Implemented Phase 1 of `docs/SPEC-humanizer.md` — P0 only (standalone module + deterministic scanner + verification). **No UI** (that's Phase 2). No new dependency.

- **`src/lib/tell-scanner.ts`** — pure regex/heuristic scanner, **zero imports** (copy-importable into any app). Counts the 10 Appendix A tell categories (em-dash overuse, metronomic rhythm, wrap-up/conclusion, listicle/triad, sycophantic openers, missing contractions, "not just X, it's Y", inflated importance, hollow profundity, banned diction). `scanTells(text, { bannedWords })` → `{ total, byCategory }`. Exports `CATALOG_BANNED_WORDS` as the single source of truth for the diction list. The metronomic-rhythm check is a coefficient-of-variation heuristic over sentence word-counts (needs ≥5 sentences, mean ≥6 words). Reproducible for identical input.
- **`src/lib/humanize.ts`** — the contract from the spec verbatim (`HumanizeOptions` / `HumanizeResult` / `humanize(text, opts)`). **Imports nothing from domain code** — only the sibling scanner + the Anthropic SDK. Caller supplies `apiKey`, `voiceExamples` (raw strings), `bannedWords`, `styleNotes` (no env coupling). Default `passes = ["tells"]` + `audit` on; voice pass runs **only** when `passes` includes `"voice"`. Pass order: **voice (adds) → tells (removes) → audit (residue)**. SDK used exactly like `claude.ts`: `claude-sonnet-4-6`, `maxRetries: 0`, 60s client timeout, forced `tool_use` (`submit_rewrite` → `{ text, changes }`), honours `opts.signal` via per-call request options. **No prompt caching in v1.** The evidence-ranked Appendix A catalog is baked into the Tells-pass system prompt; `opts.bannedWords` merged with the catalog list. Every pass prompt explicitly preserves meaning, numbers, links, @handles, and `[VERIFY]` markers. Returns token usage in the app's `{ inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens }` shape.
- **Light format guardrails** (`format: x_thread | ih_long | reddit | plain`) steer in-prompt only (P0); hard enforcement (≤280 chars etc.) is P1.

**Verification (Appendix B):**
- *Scanner (done, deterministic, no key/cost):* ran the real `tell-scanner.ts` via `node --experimental-strip-types` over X/IH/Reddit samples — slop drafts scored 14 and 20 tells across the catalog; a clean human draft scored **0** with its `[VERIFY]` preserved; all scans reproducible.
- *Gates (done):* `npx tsc --noEmit` clean; `eslint` clean on both new files. (Run the official `npm run build` + `npm run lint` before committing.)
- *`humanize()` live run (deferred to Ben — needs the API key + costs money):* harness at **`scripts/humanize-verify.mjs`** (untracked; `git add` to keep or delete it). Run from the project root:
  `node --experimental-strip-types --import ./scripts/ts-resolve-hook.mjs --env-file=.env.local scripts/humanize-verify.mjs`
  It checks `tellsAfter < tellsBefore` and that no `[VERIFY]`/numbers were dropped on a starter test set; expand toward the 20-draft set and log the result here.

**Runtime loader fix (harness only — no source change):** Node's native `--experimental-strip-types` loader uses strict ESM and can't resolve `src/lib`'s extensionless relative imports (`humanize.ts` → `"./tell-scanner"`), and `--experimental-specifier-resolution=node` was removed in Node 24. Rather than change the source imports (kept extensionless to match `claude.ts`/`env-keys` and to not risk the Next build), added a tiny self-registering ESM resolver hook at **`scripts/ts-resolve-hook.mjs`** that appends `.ts` when an extensionless relative specifier fails to resolve. It registers its own hooks on the main thread and only exports `resolve` on the hooks worker (`isMainThread` guard). Activate with `--import ./scripts/ts-resolve-hook.mjs` (see run command above). Verified: the `humanize → tell-scanner` chain now loads (probe + the harness reaching its API-key guard with zero Claude calls); `eslint .` passes with the new scripts included; no source touched, so `tsc`/`next build` are unaffected. The benign `MODULE_TYPELESS_PACKAGE_JSON` warning is left as-is — silencing it needs `"type":"module"` in the root `package.json`, which could affect the Next build (not worth the risk for a dev script).

**Not done (by scope):** Phase 2 on-demand UI trigger (the seam is between generate and persist — `draftMoment` / `draftRedditForSub` / `regenerateDraft`). Open spec questions still standing: v1 default passes (assumed tells-only), prompt-cache (skipped), UI trigger location, dep check (zero new deps — confirmed).

## 2026-06-21 — Cleared the 6 react-hooks v7 warnings (lint-correctness pass)

- Fixed the underlying patterns (no suppression) and promoted both rules (`react-hooks/set-state-in-effect`, `react-hooks/purity`) back to **`error`** in `eslint.config.mjs`. `.eslintrc.json` was already gone (nothing to delete).
- **`theme-toggle.tsx`** — the next-themes hydration mount guard moved from `useState(false)` + `useEffect(() => setMounted(true))` to **`useSyncExternalStore`** (server snapshot `false`, client `true`): same hydration behaviour, no set-state-in-effect, no dep.
- **`generate-now-button.tsx`, `generate-button.tsx`, `batch-form.tsx`** — the elapsed-timer effects dropped their synchronous `setElapsed(0)` (the flagged line); the reset moved into the click handler. `elapsed` only renders while running, so behaviour is identical. The interval's setState (a timer callback) was never the problem.
- **`batch-form.tsx`** — the after-mount default-start-date `useEffect` (set-state-in-effect, there to dodge a hydration mismatch) is gone: the next-Monday default is now computed **server-side** in `batch/page.tsx` and passed as a `defaultStartDate` prop, so the form initialises state directly and server/client markup match.
- **`app-header.tsx`** — the `Date.now()` "missed run" check (a server-component render impurity) moved into a plain `isRunMissed()` helper; the same `new Date()`-in-render concern for the batch default-date was handled by computing it in a plain `nextMonday()` helper, not the component body.
- **Note on the task's framing:** the actual purity (`Date.now()` in render) warning was in `app-header.tsx`, not the generate buttons (those were all set-state-in-effect). Fixed each at its real site.
- **Mapping note:** the next-themes guard now needs **no** mount effect at all — `useSyncExternalStore` is the idiomatic React 18 hydration-detection primitive.
- **Verified:** `npm run lint` (rules at error) → 0 problems; `npx tsc --noEmit` → clean; `npm run build` → succeeds. Behaviour unchanged. No new dependency.

## 2026-06-21 — Fix: coerce moments.source_ref jsonb to array on read (restores source context)

- Sibling fix to BIPS-L7. The probe from the previous commit confirmed `moments.source_ref` (jsonb) comes back from postgres.js as a **string**; its `Array.isArray`-only guard silently yielded `[]`, so `source_refs` was empty on **every DB read** — blank SHA badges on moment cards, degraded regenerate context, and on-demand Reddit drafts missing their commit/note context.
- **Extracted `coerceStringArray` to a shared `src/lib/json.ts`** (one helper, no copies); `subreddits.ts` now imports it instead of its local copy. Applied it at the **three** `source_ref` mapping sites: `getMomentById`, `getMomentsByGeneration`, and `claude-regenerate` (the mapper of `getDraftWithMoment`'s row). Removed the `Array.isArray`-only guards that masked the bug, and fixed the misleading "postgres.js parses it for us" comment.
- **Ground truth** (throwaway probe on real data, then deleted): **before** fix `source_refs` = `0` for every moment; **after** fix `source_refs` populate with real SHAs and the exact on-demand `relevantCommits` filter returns **1–5 matches per moment** (against 213 commits in the DB). Regenerate uses the same data path.
- **BIPS-L7 updated:** `moments.source_ref` marked ✅ RESOLVED; `coerceStringArray` (`src/lib/json.ts`) named the canonical helper for all jsonb array columns.
- **Verified:** `npx tsc --noEmit` + `npm run lint` clean (same 6 pre-existing warnings); `npm run build` succeeds. No new dependency.

## 2026-06-21 — Fix: jsonb `prepost_checklist` crash + DB pages made dynamic

- **Build-blocking:** `vercel build` failed prerendering `/settings` — `TypeError: (a.prePostChecklist ?? []).join is not a function`. Reproduced locally first (Bug Diagnosis Loop, no fix-and-pray).
- **Ground truth** (throwaway probe, same `db.ts` settings): `subreddits.prepost_checklist` is `jsonb` but **postgres.js returns it as a JSON string** here (`typeof 'string'`, `isArray false`), e.g. `'["…"]'`. The declared `string[] | null` type isn't enforced at the read boundary.
- **⚠️ Bigger finding:** the same probe shows `moments.source_ref` (also jsonb) is **also a string** — and its `Array.isArray` guard silently falls through to `[]`. So `source_refs` has been **empty on every DB read** (affects moment-card badges, regenerate context, and on-demand Reddit draft source material — the generation path uses the in-memory refs so it's unaffected). The task cited `moments.ts` as a *good* precedent; it's actually the **same latent bug**. Flagged + recommended as a focused follow-up; **not** bundled into this scoped commit. Captured in **BIPS-L7**.
- **Fix (this commit):**
  - `subreddits.ts` — coerce `prepost_checklist` at the read choke point (`coerceStringArray`/`rowToSubreddit`: parse string → guard `Array.isArray` → filter to strings → else null) in `getSubreddits`, `getSubredditBySlug`, and the `createSubreddit` RETURNING map. Declared type stays honest.
  - `/settings` render — `Array.isArray(x) ? x : []` belt-and-braces on the `.join`.
  - **All 9 DB-reading pages** get `export const dynamic = "force-dynamic"` — they were being statically prerendered against the **prod DB at build time**, which both reads prod during the build and turns a bad read into a hard build failure.
- **Verified:** `npx tsc --noEmit` + `npm run lint` clean (same 6 pre-existing warnings); `npm run build` now **succeeds** — route table shows every page as `ƒ (Dynamic)` and `/settings` no longer prerenders. Lesson **BIPS-L7** added. No new dependency.

## 2026-06-21 — User-managed subreddit catalog (add subs without a code change)

- Implemented `docs/specs/user-managed-subreddits-spec.md`. Subreddits moved from the hardcoded `reddit-subs.ts` config (+ fixed-slug `CHECK`) to a user-managed DB catalog. Confirmed all spec-assumed consumers on the real checkout before starting.
- **Schema:** applied migration `0005` to Neon via a throwaway transactional runner — `subreddits` table; **dropped** `drafts_subreddit_check`; **added** `drafts_subreddit_format_check` (`^[A-Za-z0-9_]{1,50}$`); **kept** `drafts_reddit_subreddit_check`; **no FK** `drafts.subreddit → subreddits.slug` so removing a sub never orphans historical drafts. Verified (9 columns, 2 constraints), runner deleted.
- **Data layer:** new `src/lib/subreddits.ts` — `SubredditRow`/`SubredditView` + `toView`, `getSubreddits`/`getSubredditViews`/`getSubredditBySlug`, `createSubreddit`/`updateSubreddit`/`deleteSubreddit`, `submitUrlFor`. Slug validation (`^[A-Za-z0-9_]{1,50}$`, strip leading `r/`, case-insensitive dedupe); only name required. Rows spread before client boundaries (BIPS-L4).
- **Seed:** `reddit-subs.ts` is now `DEFAULT_SUBREDDITS` + isomorphic helpers (`submitUrlFor`, `normalizeSlug`, `isValidSlug`, `MAX_SUBS_PER_GENERATE`). `seedDefaultSubreddits()` (`INSERT … ON CONFLICT (slug) DO NOTHING`) runs once, **flag-guarded** (`subreddits.seeded`) so deleting all subs later won't re-seed them. Dropped the `SubSlug` union — slugs are validated strings now.
- **Swap (9 files):** `SUBREDDIT_RULES`/`SubSlug`/`isSubSlug` removed across `claude.ts`, `claude-regenerate.ts`, `copy-open-flow.tsx`, `moment-card.tsx`, `settings.ts`, `reddit-autogen-section.tsx`, `settings/page.tsx`. Client components (moment card, settings sections) receive the catalog as **props** from server components (dashboard + settings pages); `copy-open-flow` derives the submit URL from the slug (no catalog needed).
- **Settings:** new "Manage subreddits" CRUD — add (name required; tone/self-promo/checklist/flair optional, with a placeholder nudging the self-promo rule), edit, remove. The per-project selector lists the catalog. Removing a sub also drops it from every project's `reddit.subs.<repo>` (OQ2).
- **Generation:** `draftRedditForSub` + `generateRedditForRepo`/`generateRedditDrafts` read tone/rules from the catalog; blank fields → a generic journey steer (no per-sub tone line) and the moment card hides the checklist block. Journey format + banned words + `[VERIFY]` + the 3-cap are unchanged. A slug removed from the catalog still drafts (generic fallback), and historical drafts keep rendering.
- **Verification:** `npx tsc --noEmit` + `npm run lint` clean (same 6 pre-existing react-hooks warnings). No new npm dependency.

## 2026-06-21 — Per-project Reddit subs + auto-generate on the dashboard (v1: dashboard-only)

- Implemented `docs/specs/reddit-auto-generation-spec.md` v1 — **dashboard path only**, cron half deferred per the spec's open question 1 (its single 60s invocation loops all repos; adding Reddit there needs the budget addressed first). Confirmed all spec-assumed symbols existed on the real checkout before building.
- **`settings.ts`:** `getRedditSubs(repo)` / `setRedditSubs(repo, subs)` over a `reddit.subs.<repo>` JSON-slug-array key. A shared `normalizeSubs` validates against `SUB_SLUGS`, dedupes, and caps at `MAX_SUBS_PER_GENERATE` on **both** read and write, so a stale/hand-edited value can't exceed the budget or smuggle a bad slug. Empty = off (opt-in).
- **Settings page:** new "Reddit auto-generation" section (`reddit-autogen-section.tsx`) — per watched repo, the same sub-pill UI as the moment card; toggling a pill auto-saves via `saveRedditSubsAction` (per-repo pending/saved/error). Off-state and the 3-cap shown.
- **`claude.ts`:** `generateRedditForRepo(repo, generationId)` — reads the repo's subs (empty → `{count:0}`, **zero Claude calls**), pulls the run's moments via `getMomentsByGeneration`, builds a (moment × sub) job list, drafts all in parallel with `draftRedditForSub`, then `deleteRedditDraftsForSub` + `insertRedditDraft` (same persistence as on-demand — replaces a still-draft row, never clobbers approved/posted). Whole pass wrapped in the shared `withTimeout` (90s). Extracted `withTimeout` to `src/lib/timeout.ts` so both `dashboard-actions` and `claude` reuse it.
- **`dashboard-actions.ts`:** `generateRedditForRepoAction(repo, generationId)` (its own bounded invocation). `generateForRepoAction` already returns the `generationId` in its result, so the client just passes it on.
- **`generate-now-button.tsx`:** after `generateForRepoAction(repo)` succeeds with moments, fires `generateRedditForRepoAction` as a second bounded step; new per-repo `reddit` sub-state ("drafting Reddit…") and a `+N Reddit` / `Reddit failed: …` line. A Reddit failure marks only that step failed and the loop continues to the next repo.
- **Left as-is:** the per-moment Reddit picker (override). Cron route untouched.
- **Verification:** `npx tsc --noEmit` + `npm run lint` clean (same 6 pre-existing react-hooks warnings). No new npm dependency.

## 2026-06-21 — Timeout guards on per-repo generate (no more infinite hang)

- **Bug:** `generateForRepoAction` called `syncOneRepo` + `generateDrafts` with **no timeout**, unlike `generateAllDraftsAction` (which races its sync against 10s). A stalled GitHub or Anthropic call could hang the per-repo server action forever; the client loop `await`ed it, so the spinner ticked indefinitely and the per-repo queue stalled on the bad repo. Confirmed on the real checkout before fixing.
- **Fix (no new dependency):**
  - `generateForRepoAction`: added a `withTimeout` helper (races a promise against a timer it always clears). Sync is raced against **10s** (non-fatal → fall back to cached commits); generation is raced against **90s**, rejecting with a clear `generation timed out for <repo>`.
  - **Every Anthropic client** now sets `timeout: 60_000` — `claude.ts` (main + reddit), `claude-regenerate.ts`, and both clients in `claude-summaries.ts` — so a stalled connection fails fast instead of sitting toward the SDK's 600s default. `maxRetries: 0` kept.
  - **Stage timing logs keyed by repo:** sync (in the action), `identifyMoments` + `draftMoment` (in `generateDrafts`) — so a future hang shows WHERE it stalls in the server logs.
  - `generate-now-button.tsx`: a client-side **120s** ceiling per repo (above the server worst case) as a belt-and-suspenders net; a failed/timed-out repo is marked failed and the loop **continues to the next** (it already didn't break, since the action returns `{ok:false}` rather than throwing).
- **Verification:** `npx tsc --noEmit` + `npm run lint` both clean (same 6 pre-existing react-hooks warnings).

## 2026-06-21 — Suspected BIPS-L8 NUL corruption: investigated, none found

- Opened this session to recover from a suspected BIPS-L8 recurrence (NUL-byte corruption of source files + clobbered lesson docs). **Per the Bug Diagnosis Loop, verified before touching anything — and the premise did not hold in this working tree.**
- **NUL scan of all 111 tracked files:** the only files containing NUL bytes are legitimate binaries (6 `docs/screenshots/*.jpg`, `src/app/favicon.ico`). **Zero text/source files corrupted.** No CRLF churn beyond the usual; `git status` showed only `CLAUDE.md` + `KNOWN-ISSUES.md` modified.
- **The "lost" lesson edits were not lost** — they were sitting intact as uncommitted changes, and *more complete* than the re-apply sketches: `CLAUDE.md` already had the full **BIPS-L6** lesson (Next 16 removed `next lint` / ESLint 9 ignores `.eslintrc.json`), `KNOWN-ISSUES.md` already had the 6 react-hooks-v7-warnings entry. `NOTES.md`/`PROJECT.md` carried the Reddit + tab session entries (committed). `docs/Ways-of-Working.md` (gitignored) still contained `### L15`.
- **Action taken:** no `git restore`, no re-apply (both would have *deleted* good content). Committed the existing `CLAUDE.md` + `KNOWN-ISSUES.md` edits as-is, after `git add --renormalize` to settle line endings and a clean `tsc` + `lint` pass. BIPS-L8 did **not** recur this session.

## 2026-06-21 — Reddit drafts in their own tab (UX fix)

- **Bug:** Reddit was rendered as a separate `<RedditSection>` *below* the X/IH tabs, so it visually attached to whatever tab was active (default X) and read as "part of the X post". Being on-demand, it was also easy to miss entirely.
- **Fix (`moment-card.tsx` only):** promoted Reddit to a proper third tab. Tab order is now **X thread → Reddit → Indie Hackers** (still hand-rolled buttons — no `@radix-ui/react-tabs`, no new dep). The Reddit tab's panel renders the existing sub multi-select + per-sub `RedditDraftCard` list + empty state; the standalone below-tabs `RedditSection` call is gone. New `RedditTabDot` shows an aggregate dot on the Reddit tab — teal if any reddit draft is approved/posted, the neutral draft dot if reddit drafts exist but none are live, and nothing until the first is generated.
- **Unchanged:** X/IH tab behaviour, and the Reddit generation path (`generateRedditDraftsAction` stays on-demand per moment). No data-layer or generation changes. `npx tsc --noEmit` + `npm run lint` both clean.

## 2026-06-20 — Phase 1.5c shipped: Reddit drafting (Claude Code build session)

- Built Campaign 1 from the implementation plan. Reddit is now a first-class third platform alongside X and Indie Hackers.
- **Schema:** applied migration `0004` **Part A only** to Neon (extends `drafts.variant` with `reddit`, adds `subreddit` with a curated-slug CHECK + a variant↔subreddit consistency CHECK, adds `title`, plus a partial index). Applied via a throwaway transactional runner connecting with the same `postgres.js` settings as `src/lib/db.ts` (Ben authorised the direct prod-DB write after the auto-mode classifier initially blocked it); verified the two columns, both constraints, and the index, then deleted the runner. Part B (citation tables) deliberately **not** applied — that's Phase 2.5.
- **New config:** `src/lib/reddit-subs.ts` — versioned `SUBREDDIT_RULES` for the four subs (toneNote, selfPromoRule, prePostChecklist, flairHint, submitUrl), marked "last reviewed 2026-06". No runtime scraping.
- **Generation:** new `draftRedditForSub()` + `generateRedditDrafts()` in `claude.ts` via a `submit_reddit_draft` tool returning `{title, body}`. One Claude call per (moment × sub), parallel, reusing the cached `DRAFT_SYSTEM_PROMPT`; only the per-sub user message varies. Journey-format contract + banned words + `[VERIFY]` enforced per sub. Re-running a sub replaces its still-`draft` row (never clobbers approved/posted).
- **Data access:** added `subreddit`/`title` to `DraftRow` and every drafts SELECT (`moments.ts`, `draft-mutations.ts`, `history.ts`); new `insertRedditDraft` / `deleteRedditDraftsForSub` / `getMomentById` helpers. Rows spread into plain objects before the Server→Client boundary (BIPS-L4).
- **UI:** moment card gains a Reddit section — sub multi-select (cap 3), generate button, neutral empty state, and per-sub draft cards showing the title (with copy-title button), the sub's pre-post checklist, and the reused edit/regenerate/approve/reject + Copy+Open (wired to `r/<sub>/submit`). `claude-regenerate.ts` now redrafts a Reddit body in place (keeps title). Shared `variantLabel()` helper in `format.ts` so reddit shows `r/<sub>` everywhere (history, scheduled, voice examples) instead of being mislabelled.
- **Voice learning:** `getStarredExamples()` takes an optional variant filter; Reddit generation samples starred *Reddit* drafts. `/history` platform filter now includes Reddit.
- **Lint tooling fixed (same commit):** `npm run lint` was broken repo-wide — Next 16 removed the `next lint` command and the legacy `.eslintrc.json` + Next plugin chain threw a circular-structure error under ESLint 9. Migrated to ESLint flat config: new `eslint.config.mjs` composing `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` (both ship as flat arrays in v16), deleted `.eslintrc.json`, changed the `lint` script to `eslint .`. **No new dependency** — every plugin was already installed. Fixing the command surfaced 9 pre-existing problems (none in the Reddit code): fixed the 3 clear ones (2 unused imports + a `require()` in `tailwind.config.ts`); the remaining 6 are `react-hooks` 7's new `set-state-in-effect`/`purity` rules firing on components that predate them (next-themes mount guard, timer resets, a `Date.now()` in render) — downgraded to **warnings** (visible, non-blocking) pending a dedicated cleanup pass.
- **Verification:** `npx tsc --noEmit` clean (exit 0); `npm run lint` clean (exit 0, 6 pre-existing warnings). **No new npm dependency. No auto-posting** (Copy + Open only).

## 2026-06-20 — Scoped Reddit drafting + citation tracking (Cowork planning session)

- Planning-only session in Cowork. No production code written (handoff protocol). Output: a feature spec, an implementation plan, and the Neon schema — all under `docs/specs/` + `migrations/0004_citation_loop_schema.sql`.
- **Two new capabilities scoped:** (A) Reddit post generation in the journey-post format, per-sub-tailored for r/SaaS, r/indiehackers, r/SideProject, r/microsaas; (B) citation tracking — the post→outcome loop that measures AI-answer-engine citations and attributes them back to the posts Studio wrote.
- **Decisions locked with Ben:** Reddit = one tailored draft per *selected* sub (new `subreddit` column, multiple reddit drafts per moment, cap 3/moment). Sequencing = Reddit ships **before** the OSS launch as Phase 1.5c; citation tracking ships **after** launch as Phase 2.5. BYO keys = stored **encrypted in Neon** (settings table, namespaced keys) from day one, decrypted with a single env `ENCRYPTION_KEY` shared by the Vercel app and the homelab scanner container.
- **Citation engine:** Perplexity Sonar first (native citations, ~pennies/user/mo). Gemini grounding + OpenAI web-search are P2 adapters behind a common interface. Google AI Overviews skipped (no API). No paid social-engagement APIs — a manual paste-in field covers likes/reposts instead.
- **Scanner runs off-serverless:** a Docker container on the homelab node `wyco`, twice weekly, connecting straight to Neon. Keeps slow LLM-per-prompt work off Vercel and node-only code out of the webpack bundle (BIPS-L5).
- **Matcher:** records `cited` (brand domain in the engine's sources) vs `mentioned` (brand named in answer text, not in sources), with matched URL, engine, prompt, timestamp + full sources jsonb for re-matching. All UI figures labelled "sampled / approximate" — never an exact count. Attribution is framed as correlation, not causation.
- **Dependencies:** zero new npm deps planned (native `fetch` + `node:crypto` + existing `postgres.js`). One new env secret: `ENCRYPTION_KEY`, fail-closed like `CRON_SECRET`.
- **Verification:** `0004_citation_loop_schema.sql` parsed clean against the Postgres grammar (pglast, 20 statements). Confirmed the dropped `drafts_variant_check` matches Postgres's auto-name for the inline check in 0001. Spec/plan checked against all CLAUDE.md hard rules + project rules.
- **Open questions carried to Code** (see spec §D): key-rotation story (D3, blocking B0.3), exact Perplexity Sonar response shape (D4, blocking — handled by a mandatory pre-flight API-shape audit per WoW L12), scan idempotency window (D5, blocking B0.6).
- **Next:** start Campaign 1 (Reddit) in Claude Code — apply migration 0004 Part A in Neon first, then build per the implementation plan. Citation tracking (Campaign 2) waits until after the OSS launch.

## 2026-05-25 — Stage 9b.2 shipped — DB layer fully on Supabase

Three rounds of methodical porting:

- **Round 1 (settings + notes)** — simplest tables, smallest verification surface (`/notes`, `/settings`). Got the async/await propagation pattern established. Every DB read in a server component became `async` with `await`; many got `Promise.all` for parallel reads. The `app-header` was already async from the earlier scheduler attempt, just needed the await.
- **Round 2 (commits)** — `/debug/commits` was the test surface. `upsertCommit` ported to Supabase's `.upsert({}, { onConflict: 'repo,sha', ignoreDuplicates: true })`, returning rows only when something was actually inserted (count > 0 means new). The `deriveMomentRepo` helper in `claude.ts` lost its last `node:sqlite` query — replaced with a new `getReposForShaPrefix()` in `commits.ts`. claude.ts dropped its `db` import for the first time.
- **Round 3 (moments + drafts + history + posting)** — the JOIN-heavy chunk. `insertMomentWithDrafts` became a thin wrapper around the Postgres RPC function for real ACID semantics (replacing what we used to get from `db.transaction()`). `getLatestGeneration` and friends use PostgREST's FK-join syntax (`moments(...)` nested select). `history.ts`'s `getAllDrafts` uses `moments!inner(...)` so we can filter on `moments.repo`. Random sampling for `getStarredExamples` and GROUP BY aggregations done client-side because PostgREST doesn't expose RANDOM() or GROUP BY directly — at single-user scale this is cheap.
- **Bug caught during Round 3 verification**: timestamps all showed "Invalid Date". The previous `parseSqliteTimestamp` helper unconditionally appended a `"Z"` to anything missing one. Postgres ISO strings come back as `"2026-05-25T13:42:00+00:00"` — already valid, the appended `"Z"` corrupted them into `"2026-05-25T13:42:00+00:00Z"` which JS couldn't parse. Fixed by trying direct parse first, falling back to the SQLite shape only if needed. Renamed to `parseTimestamp` and exported so `claude.ts` could drop its duplicate helper.

**`db.ts` deleted** — zero callers remain. Project no longer imports `node:sqlite` anywhere. Vercel can deploy it as a pure pure-JS Next.js + Postgres app.

**Voice-learning loop** — Ben deferred testing to user acceptance / weekly real-use cycle. The code paths are wired; whether the prompt actually shifts voice in a noticeable way is a multi-week judgement, not a same-day verification.

Net effect: ~10 files ported, ~10 caller files updated, one file deleted. Bug-class lessons unchanged (no new BIPS-L#). Migration was almost entirely mechanical — the architectural rethink in Phase B of the previous session was where the real thinking happened.

## 2026-05-25 — Stage 9 abandoned; pivot to Supabase + Vercel; 9b.1 shipped

A long, important session. Three phases:

**Phase A — Stage 9 attempt and failure.** Tried to ship the original spec's Monday-9am scheduler using node-cron inside Next.js's `src/instrumentation.ts` hook. Hit five sequential webpack-bundling bug classes:

1. **`experimental.instrumentationHook: true`** flag turned out to be required despite Next.js 14.2 release notes claiming otherwise.
2. **`node-notifier`** pulled in `is-wsl` → `is-docker` → `fs` and `growly` → `net`. Webpack couldn't resolve the Node built-ins via the deep transitive chain. `serverComponentsExternalPackages` helped for one chain but the next transitive dep failed identically. Decided to drop node-notifier entirely (Option B from the three-way decision); the dashboard's "Last run" header IS the user-facing notification for a weekly tool.
3. **`node-cron`** itself had the same issue via its worker-script chain (`background-scheduled-task/index.js` → `path`). Replaced with a setTimeout + cron-parser scheduler (cron-parser was already a dep for the header).
4. **`node:crypto`** URI scheme rejected by webpack's instrumentation bundle pass — `UnhandledSchemeError`. The same pass apparently handled `node:sqlite`, `node:fs`, `node:path` in route bundles but not in the instrumentation chain.
5. **Bare `crypto`** then refused to resolve either. At that point we knew the instrumentation bundle context was fundamentally broken for our use case.

Captured as **BIPS-L5** in `CLAUDE.md` with the full taxonomy: legacy-Node npm packages, transitive Node built-in deps, `serverComponentsExternalPackages` doesn't reliably help, and the `node:` URI scheme is unreliable across bundling passes.

**Phase B — architectural rethink.** Stepped back. Three options on the table: drop in-process scheduling (10 min), migrate to Supabase + Vercel (4–6 hours), or hide the scheduler from webpack with a dynamic-require trick (5 min hack, technical debt). Ben (with Supabase + Vercel experience) chose the migration — the right call, because it permanently removes this class of fight, gives us a live URL for credibility, and brings the project onto the WyCo standard stack documented in `docs/Tech-Stack.md`. Phase 1.5b's scheduled-posts feature also becomes trivial on the new stack (postgres `due_at` column + Vercel Cron hourly check).

**Phase C — Stage 9b.1 setup.** Supabase project created in London region for UK data residency. CLI installed globally. `supabase init` + `supabase link` succeeded. Initial schema migration written by hand (file: `supabase/migrations/20260525000000_initial_schema.sql`, mirrors the retired `db.ts` schema with Postgres idioms — `bigserial`, `timestamptz`, `jsonb`, RLS enabled per WyCo Tech-Stack rule). `supabase db push` applied cleanly; all six tables visible in the dashboard's Table Editor. Types generated to `src/types/database.ts` via the `cmd /c` wrapper from `docs/Ways-of-Working.md` Lesson L2 (the standard PowerShell-mangles-UTF-8 fix). `.env.local` populated with all three Supabase keys.

The app still runs on `node:sqlite` for now — Stage 9b.2 ports the DB access layer. The pivot's foundation is in place.

**Files deleted:** `src/instrumentation.ts`, `src/lib/scheduler.ts`, `src/lib/notifications.ts` (the failed Stage 9 chain).
**Files added:** `supabase/config.toml`, `supabase/migrations/20260525000000_initial_schema.sql`, `src/types/database.ts`.

## 2026-05-25 — Session end: Phase 1.5 scoped, pause for real use

Ben surfaced two new features after using the tool end-to-end:

1. **Product summaries** (per-project, structured) — website summary + launch announcement. Separate from the weekly moment flow.
2. **Batch from previous work + scheduling** — generate 10–15 moments from a longer window (30/90/180 days), auto-suggest staggered release dates over the next 2-3 weeks, queue view with date-based notifications. Never auto-publishes.

Both documented as **Phase 1.5** in `docs/PLAN.md` with the scope decisions captured. Sequencing recommendation: Stage 9 first (notification foundation), then 1.5a (Summaries — smaller, faster), then 1.5b (Batch + scheduling — reuses Stage 9's notifications), then Stage 10 polish, then Phase 2 OSS launch.

**Session totals:** 8 of 10 original stages shipped (Stages 1–8 + market research + project linkage + dashboard project tabs + UX polish on pill tabs). 4 bug-class lessons captured in `CLAUDE.md` (BIPS-L1 through L4, all `node:sqlite`-related or Cowork-sandbox-related). All committed and pushed.

Pause for real Monday-morning use. Stage 9 / 1.5a / 1.5b / Stage 10 wait for next session.

## 2026-05-25 — Stages 7 + 8 + project linkage + dashboard polish shipped

This batch covers everything from the end of Stage 6 through to the pill-style project tabs, since we deferred docs commits until the run of stages closed out.

**Stage 7 — Copy + Open flow.** Approved variants get a real "Copy + Open X / Indie Hackers" button (the Stage 6 placeholder is gone). Click does three things at once: copies to clipboard, opens the platform's compose URL in a new tab, transitions a local panel to "Copied — paste with Ctrl/Cmd+V". A "Did you publish it?" prompt then appears after 60s OR the moment focus returns to the dev tab (whichever first — the focus event is the natural "I'm done publishing" signal). Save URL → status flips to "posted", URL + timestamp persisted. "Posted" state is DB-backed and permanent. The simpler "Not yet" / 60s timeout collapses cleanly back to the Copy + Open button.

**Stage 8 — History + voice learning.** New `/history` page, server-rendered, four URL-driven filters (status / variant / rating / project). Per-row rating buttons (★ / – / 👎) with optimistic UI and toggle behaviour. The voice loop: every full generation pulls up to 10 random starred drafts (posted-and-starred preferred over just-starred) and injects them into the user message as voice examples, with explicit instructions to match rhythm + specificity without pastiching. Adds ~500–2000 input tokens per generation depending on how many starred drafts exist.

**Project linkage.** Mid-stage feature ask: notes and moments needed to be project-aware. Added `repo` column to both `notes` and `moments` via a new `addColumnIfMissing()` migration helper in `db.ts` (since `node:sqlite` doesn't ship migration tooling — checks `pragma_table_info` then `ALTER TABLE ADD COLUMN` if missing, idempotent, safe). Note form has a "Link to project" select; moments derive repo at insert time by looking up source refs (commit SHAs → commits.repo, note ids → notes.repo, common-repo-if-all-match-else-null). History got a fourth filter dropdown for project.

**Dashboard project tabs + UX polish.** Tabs above the moment list, server-rendered as `<Link>`s, no client state. Pill-button styling — three colour states: default (muted), active (teal fill), all-actioned (lime fill or tint depending on active state). "All actioned" means every draft of every moment in that project is out of `draft` state. Tabs only render when there's more than one bucket — single-project weeks don't get a noisy tab bar. URL-driven (?project=owner/name) so back/forward works.

**`displayProjectName()` helper** strips the "owner/" prefix everywhere a project name is visible — dashboard tabs, dashboard heading, history badges, history filter dropdown, notes badges. DB and URL params keep the full "owner/name" for stability (no collisions if two repos share a name).

**Bug fixes captured as lessons during this batch:**
- **BIPS-L3:** `node:sqlite` has no `.transaction()` helper. Hit during Stage 5; the `transaction()` helper in `db.ts` is the fix. Used by `insertMomentWithDrafts`.
- **BIPS-L4:** `node:sqlite` returns null-prototype rows; spread them before crossing the Server → Client component boundary. Hit during Stage 6; `getLatestGeneration` and `getAllDrafts` now `.map(r => ({...r}))` defensively.

**Note for future:**
- Voice-learning loop is wired but Ben deferred testing it — wants to play with the qualitative output later.
- We've drifted further from the "same commit as user-visible change" rule for PROJECT.md updates. This entry batches docs for ~5 user-visible changes shipped across the session. Worth tightening if we get back into a normal weekly cadence rather than marathon sessions.

## 2026-05-25 — Stage 6 shipped

- The dashboard is the real dashboard now. Latest generation's moments at `/`, one card each, hand-rolled tabs (no `@radix-ui/react-tabs` dep — two-tab toggles don't justify it). Each variant card owns its own edit / regenerate / approve / reject / revert lifecycle as a client component.
- **Single-variant regenerate** is the per-moment fast path: smaller Claude prompt, smaller tool schema (one string output), `max_tokens: 1024` instead of 4096, same cached system prompt for cache-hit savings. Wall-clock 5–10s vs the full generation's 45–90s — exactly the user experience we want for "I don't quite like this draft, try again".
- Tabs aren't shadcn-Radix; they're a `<button>` pair with `useState`. Small status dot next to each label so you can see at a glance whether the X variant or the IH variant is approved.
- **Bug hit during Stage 6:** `Only plain objects ... can be passed to Client Components`. Caused by `node:sqlite` rows being null-prototype objects which Next.js's RSC serializer rejects. Fixed by spreading each row (`{...d}`) in `getLatestGeneration` before returning. Captured as **BIPS-L4** in CLAUDE.md. Loop closed in one round-trip again — symptom → identified null-prototype rows from the trio of `node:sqlite` quirks (now L2 / L3 / L4) → fix → audit (one location) → capture.
- Audit ran: every other Server-Component reading from `node:sqlite` renders rows directly in JSX (Notes, Commits, the Draft debug view) rather than passing them to a Client Component, so the same bug couldn't surface there. Worth knowing for any future page that adds new Client Components consuming DB data — spread defensively in the data-access layer.

## 2026-05-25 — Stage 5 shipped

- First end-to-end **"commits + notes → Claude → drafted moments"** call working. Sonnet via `@anthropic-ai/sdk`, `tool_use` for guaranteed structured output, `cache_control: ephemeral` on the system prompt and tool schema for ~90% cache savings on the repeat-call portion.
- The cached system prompt encodes the voice rules — moments-not-commits, banned words, `[VERIFY]` markers, "beginner-learning is the angle not a weakness". The user-message holds the variable bits (this week's commits + notes + user's banned words from Settings + style notes). That split is what makes caching actually save anything.
- Schema design follows the WyCo Tech-Stack lesson: `minItems: 0` on the moments array rather than `minItems: 3`, with the prompt encouraging 3-5. Over-constraining a tool schema is a known way to get empty arrays from Sonnet.
- `/debug/draft` is the inspection view — like `/debug/commits`, intentionally unlinked. Stage 6 will turn the moment-rendering into the real dashboard.
- **Bug hit during Stage 5 testing:** `db.transaction is not a function`. Caused by writing better-sqlite3-style code (muscle memory) on a `node:sqlite` database. Fixed with an explicit `transaction()` helper in `db.ts` using BEGIN/COMMIT/ROLLBACK. Captured as **BIPS-L3** in CLAUDE.md. Audit ran clean — no other `.transaction()` or `.pragma()` calls anywhere in the codebase. The whole loop closed in one round-trip instead of the usual 3-4.
- **Feedback from first real use:** generation took 90s — longer than my "15-30s" estimate but inside the expected range for Sonnet emitting 3-4k output tokens. Worth noting because it set up the right expectation for Stage 6 (per-moment regenerates will be much faster — single variant, single moment, ~5-10s).
- **Two small fixes shipped alongside Stage 5 in response to Ben's first-use feedback:** (a) inline trash button per note with `window.confirm` so notes can be deleted (was a real gap in Stage 2's notes page), (b) elapsed-seconds counter on the generate button so the 90s wait feels like progress rather than a frozen UI.
- Commit hygiene note: we've drifted slightly from the "same commit as user-visible change" rule for PROJECT.md updates — instead doing a small docs-only follow-up commit per stage. Pragmatic for this session's pace; worth tightening if we ever revisit.

## 2026-05-25 — Stage 4 shipped

- GitHub commit sync built on **Octokit** (the official SDK from GitHub). First "real outside data" stage. Pure-JS install, no Stage 2-style native-binding drama.
- `octokit.paginate(rest.repos.listCommits, { owner, repo, since, per_page: 100 })` flattens all pages into a single array — saves us writing a pagination loop by hand. `since` set to 7 days ago.
- Idempotent re-runs via `INSERT INTO commits ... ON CONFLICT(repo, sha) DO NOTHING`. Hitting "Sync now" twice returns "0 new" the second time, exactly as it should.
- Per-repo error handling instead of throw-on-first-error: a 404 on one repo (token doesn't have access) is collected into a `failures` list rather than aborting the whole sync. The UI shows successes and failures side-by-side.
- `/debug/commits` is intentionally not linked in the sidebar — it's an inspection view, not a product feature. Reach via URL or (eventually) the dashboard "Sync GitHub" button which gets wired up in Stage 6.
- File-count per commit is deliberately left null in the cache. The list endpoint doesn't include it, and fetching it would mean a per-commit API call — wasteful when we only need counts for the moments Claude selects. Stage 5 can fetch them lazily.
- Ben confirmed the round-trip end-to-end: commits visible, persist across restart, idempotent re-sync.

## 2026-05-25 — Stage 3 shipped

- Settings page now does four things: shows API-key state (read from `.env.local` server-side, never the database), validates each key with a tiny real API call, lists the user's GitHub repos for multi-select watching, persists schedule + banned-words + style-notes to the `settings` table.
- API keys deliberately stay in `.env.local` (per WyCo "Secrets never in the client"). The UI just shows binary state — "Set" or "Not set" — and triggers smoke-test calls. The key values themselves never leave the server-side env.
- Validation uses plain `fetch` rather than the SDKs. Defers `octokit` and `@anthropic-ai/sdk` to Stages 4 and 5 where they're actually needed for pagination + structured output / caching.
- Inline `<details>` "How to get this key" walk-throughs sit next to each card — beginner-friendly, no need to context-switch to the README.
- New shadcn-style `Badge` component for status pills. Variants: `success` (teal), `warning` (amber), `destructive`, `secondary` — covers all the states we care about.
- Schedule cron stays a plain string for now (full validation is a Stage 9 problem when the scheduler actually runs).
- Ben validated both keys, selected a handful of repos to watch, and saved preferences end-to-end.

## 2026-05-25 — Stage 2 shipped

- SQLite layer set up with **`node:sqlite`** (Node's built-in SQLite, stable in Node 22.5+ / fully stable in Node 24) instead of `better-sqlite3`. Decision driven by a real install failure: better-sqlite3 has no prebuilt binary for Node 24.14, and Ben doesn't have Visual Studio Build Tools to compile from source. Switching to a built-in removed a dependency rather than adding one — closer to the WyCo "prefer fewer deps" principle.
- Lesson captured as BIPS-L2 in `CLAUDE.md`: native-binding npm packages lag behind new Node versions; check Node built-ins first.
- Full schema for the whole app created upfront in `src/lib/db.ts` (notes, watched_repos, commits, moments, drafts, settings) so later stages don't need migrations. WAL mode + foreign keys enabled.
- `/notes` page: server-component renders recent notes via `getRecentNotes()`, client-component form uses Next.js `useFormState` + `useFormStatus` for inline save/error UI. Ctrl/Cmd+Enter submits. Markdown stored verbatim (no rendering dep yet — deferred to Stage 10 polish).
- `data/bips.sqlite` is `.gitignore`'d. The file appears on first run and persists across dev-server restarts. Ben verified the round trip end-to-end.

## 2026-05-25 — Stage 1 shipped

- WyCo retrofit applied: Space Grotesk / Inter / JetBrains Mono fonts via next/font/google, slate-900 dark background, teal-500 primary, "by WyCo Digital" badge in the sidebar.
- Required project memory files in place: `PROJECT.md`, `CLAUDE.md`, `NOTES.md`, `KNOWN-ISSUES.md`. Reference docs copied into `docs/`. `docs/PLAN.md` written with full Phase 0/1/2/3 roadmap.
- README rewritten as public-facing copy (audience: indie hackers reading the repo on GitHub) — lead with the "100% Claude-generated" credibility hook and the moments-vs-commits differentiator.
- Removed `next-themes` from `package.json` — it was added without asking, will come back in Stage 10 when the light toggle is actually wired up.
- Lesson captured in `CLAUDE.md`: BIPS-L1 — Cowork sandbox cannot reliably run `npm install`; all shell commands are handed off to Ben in PowerShell. This is the handoff protocol working as designed.
- Ben verified the dashboard renders correctly on localhost:3000. Sidebar nav, header, placeholder card, all four routes reachable.

## 2026-05-24 — Project kickoff

- Initial spec written by Ben in Cowork: 10-stage build plan, Next.js + SQLite + Anthropic + Octokit + node-cron, local-only.
- First attempt at Stage 1 went straight into code without reading the WyCo docs. Ben pulled me back — *"review the docs in the Ways of Working folder, apply the learning before we carry on"*. Right call.
- Read all five WyCo docs. Acknowledged the gaps: no `docs/` structure, wrong fonts (Geist instead of Space Grotesk/Inter/JetBrains Mono), wrong colours (generic shadcn slate instead of WyCo teal), no `CLAUDE.md`, no GitHub repo, deps added without asking.
- Ben asked for a market-research pivot before resuming. Concluded: real market, crowded niche, ~£20/year hosted with BYO keys is the cheapest viable SaaS floor — *but* the strongest move is OSS the local version, use it, post about it, then decide.
- Credibility framing locked in: this is portfolio / build-in-public credibility work, not revenue work. OSS launch planned for Stage 10.
- Resumed Stage 1 with WyCo retrofit. Docs in place. Visual layer next. PowerShell handoff for shell commands.
