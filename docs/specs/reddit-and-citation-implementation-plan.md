# Implementation Plan — Reddit drafting + Citation tracking

*Hand-off doc for Claude Code. Companion to [the spec](./reddit-and-citation-tracking-spec.md) and `migrations/0004_citation_loop_schema.sql`.*
*Cowork planned this; Claude Code implements it. Per the handoff protocol, each phase below ends with a ready-to-paste Code prompt.*

---

## How to use this doc

Build in two campaigns, in order:

1. **Phase 1.5c — Reddit drafting** (before OSS launch). One migration + edits to the existing generation pipeline and dashboard. Small.
2. **Phase 2.5 — Citation tracking** (after OSS launch). The same migration's Part B + new Settings, a new `/citations` page, and a standalone Docker scanner on the homelab. Larger.

Each step says which directory commands run in. Ben runs all `npm`, `git`, `gh`, Docker, and Neon-SQL-editor actions himself; Code writes the files. Run `npm run lint` + `npx tsc --noEmit` (in the project root `C:\Users\benco\code\build-in-public-studio`) before every commit; auto-push on green.

---

# Campaign 1 — Reddit drafting (Phase 1.5c)

## Integration point (read first)

Generation is two-phase in `src/lib/claude.ts`: `identifyMoments()` → parallel `draftMoment()` per moment, where each `draftMoment` calls Claude with the `submit_moment_drafts` tool returning `{ x_thread, ih_long }`. The cleanest extension (open question D7): **keep the two-phase shape; add Reddit to the per-moment draft step, parameterised by the selected sub(s).** Because each sub needs its own tone, generate Reddit drafts with **one Claude call per (moment × sub)** — reusing the cached `DRAFT_SYSTEM_PROMPT` so only the per-sub user message differs. X/IH stay exactly as they are.

## Step 1.1 — Schema (Ben applies)

Apply **Part A only** of `migrations/0004_citation_loop_schema.sql` in the Neon SQL editor (Console → SQL Editor → paste the Part A block → Run). Verify `\d drafts` shows the new `subreddit` and `title` columns and the updated variant check.

## Step 1.2 — Subreddit rules config (Code writes)

New file `src/lib/reddit-subs.ts`. A typed, versioned config — the single source of truth for the four subs. Shape:

```ts
export type SubSlug = "SaaS" | "indiehackers" | "SideProject" | "microsaas";
export interface SubredditRule {
  slug: SubSlug;
  displayName: string;       // "r/SaaS"
  toneNote: string;          // one line that goes into the prompt to steer voice
  selfPromoRule: string;     // human-readable summary of the sub's self-promo policy
  prePostChecklist: string[];// shown beside the draft in the UI
  flairHint?: string;        // e.g. "Tag with 'Self-Promotion' flair"
  submitUrl: string;         // https://www.reddit.com/r/<slug>/submit
}
export const SUBREDDIT_RULES: Record<SubSlug, SubredditRule> = { /* … */ };
```

Populate `toneNote` / `selfPromoRule` / `prePostChecklist` from current community norms (e.g. r/SaaS: weekday self-promo limits + value-first framing; r/SideProject: show-don't-sell; r/microsaas: numbers welcome; r/indiehackers: journey/transparency rewarded). Mark these as a curated snapshot with a "last reviewed" date comment so drift is visible. **No runtime scraping** (non-goal).

## Step 1.3 — Generation pipeline (Code edits `src/lib/claude.ts`)

- Add a `reddit` tool schema `submit_reddit_draft` returning `{ title, body }` for a single sub, or extend `submit_moment_drafts`. Recommended: a separate small tool + a `draftRedditForSub(moment, subSlug, voiceExamples)` function so Reddit can be generated independently of X/IH (e.g. on-demand from the dashboard, not only at weekly-generation time).
- The per-sub user message includes: the moment + its source refs, the sub's `toneNote`, the journey-format instruction (honest headline / real numbers / what went wrong / one specific insight / no forced CTA), the banned-words list, and `[VERIFY]` rule — identical guardrails to X/IH.
- Insert one `drafts` row per generated (moment, sub): `variant='reddit'`, `subreddit=<slug>`, `title=<title>`, `content=<body>`.
- Reuse the cached system prompt; only the user message varies per sub (cheap).

## Step 1.4 — Draft mutations + data access (Code edits `src/lib/draft-mutations.ts`, `moments.ts`, `history.ts`)

- Make insert/read helpers carry `subreddit` and `title`. **Spread DB rows into plain objects** before they cross into client components (BIPS-L4).
- History: add `reddit` (and per-sub) to the platform/variant filter.

## Step 1.5 — Dashboard UI (Code edits the moment card + history)

- On each moment card, add a "Reddit" section with a **sub multi-select** (cap at ≤3 per D6) and a "Generate Reddit drafts" action calling a new `generateRedditDraftsAction(momentId, subs[])` server action in `dashboard-actions.ts`.
- Render each resulting Reddit draft with: title field + body, the sub's `prePostChecklist` as a visible checklist, edit/regenerate/approve/reject (reuse existing components), and **Copy + Open** wired to `SUBREDDIT_RULES[sub].submitUrl`. Copy should place title and body sensibly (P1.3: copy body; show title for manual paste, or copy title first then body — confirm UX with Ben).
- Empty/neutral state when no Reddit draft exists yet (distinct from failure), matching the Stage-10 neutral-vs-error styling already used for no-commit repos.

## Step 1.6 — Voice learning (P1.1, can be same campaign)

In the voice-examples block of `claude.ts`, filter starred examples by variant so Reddit generation samples starred *Reddit* drafts. Add the `reddit` variant label to the example formatter.

## Step 1.7 — Docs (Code, same commits)

Update `PROJECT.md` "Shipped recently" + `docs/PLAN.md` (add Phase 1.5c, mark done when it ships) in the same commit as the user-visible change (hard rules #5, #6). Append a `NOTES.md` entry at session end.

### ▶ Code prompt — Campaign 1

```
Read docs/specs/reddit-and-citation-tracking-spec.md (Part A) and
docs/specs/reddit-and-citation-implementation-plan.md (Campaign 1), plus
src/lib/claude.ts and the dashboard moment-card components, then:

1. Create src/lib/reddit-subs.ts with the SUBREDDIT_RULES config for
   r/SaaS, r/indiehackers, r/SideProject, r/microsaas (toneNote,
   selfPromoRule, prePostChecklist, flairHint, submitUrl). Add a
   "last reviewed 2026-06" comment. No runtime scraping.
2. Add a draftRedditForSub(moment, subSlug, voiceExamples) path to
   claude.ts using a submit_reddit_draft tool returning {title, body},
   reusing the cached DRAFT_SYSTEM_PROMPT. Enforce journey format +
   banned words + [VERIFY]. One Claude call per (moment, sub).
3. Insert one drafts row per (moment, sub): variant='reddit',
   subreddit, title, content. Spread rows before client boundaries.
4. Add generateRedditDraftsAction(momentId, subs[]) (cap 3 subs) and a
   Reddit section on the moment card: sub multi-select, generate button,
   per-sub draft with the prePostChecklist shown, edit/regenerate/
   approve/reject reused, Copy+Open to the sub's submit URL.
5. Add reddit to the /history platform filter; filter voice examples by
   variant so Reddit learns from starred Reddit drafts.
6. Update PROJECT.md "Shipped recently" + docs/PLAN.md (Phase 1.5c) in
   the same commit. Lint + tsc clean, then push.

Do NOT add any npm dependency. Do NOT add auto-posting. Ask me before
the schema step — I apply migration 0004 Part A in Neon myself first.
```

---

# Campaign 2 — Citation tracking (Phase 2.5)

Build order (each is a checkpoint): **A** schema → **B** encrypted BYOK + brand config → **C** Perplexity adapter + matcher (after the API-shape audit) → **D** Docker scanner + cron on `wyco` → **E** `/citations` read UI → **F** attribution view + manual engagement.

## Step 2.A — Schema (Ben applies)

Apply **Part B** of `migrations/0004_citation_loop_schema.sql` in the Neon SQL editor. Verify `tracked_prompts`, `scan_runs`, `citation_results` exist, plus the new `drafts.promoted_url` / `drafts.engagement_manual` columns and the `uq_citation_results_prompt_engine_day` unique index.

## Step 2.B — Encrypted BYOK + brand config (Code)

- New `src/lib/crypto.ts`: AES-256-GCM via `node:crypto` (**no dep**). `encryptSecret(plaintext)` / `decryptSecret(ciphertext)` using `process.env.ENCRYPTION_KEY` (32-byte key, base64). Store iv + authTag + ciphertext together (e.g. base64 `iv:tag:data`). Fail closed if `ENCRYPTION_KEY` is missing.
- Settings page: add a "Citation tracking" section — Perplexity API key input (write-only; shows "set / not set", never echoes the key), and per-project `brand_name` + `brand_domain` fields. Persist via the existing `settings` helpers using the namespaced keys from the migration header (`apikey.perplexity` encrypted; `citation.brand_name.<repo>`, `citation.brand_domain.<repo>`).
- Add `ENCRYPTION_KEY` to `.env.local.example` with a PowerShell one-liner to generate one, and document it must be set identically in Vercel (Sensitive) and the homelab container. Same fail-closed discipline as `CRON_SECRET` (CLAUDE.md rule #5).

## Step 2.C — Engine adapter + matcher (Code, AFTER the API audit)

- **Pre-flight API-shape audit (WoW L12 / open question D4):** before writing the parser, make one real Perplexity Sonar call and dump the raw response. Build the `sources` parser around the *observed* shape, not assumptions. Record the shape in a comment.
- `src/lib/citation/engines/types.ts`: `interface CitationEngine { name; query(prompt, opts): Promise<{ answerText; sources: {url;title}[]; engine; raw }> }`.
- `src/lib/citation/engines/perplexity.ts`: implements the interface with plain `fetch` (no SDK, no dep). Gemini/OpenAI are P2 — leave the interface ready.
- `src/lib/citation/matcher.ts`: given a response + `{brand_name, brand_domain}`, returns `{ cited, mentioned, matched_url, answer_excerpt }`. Domain match = brand_domain (or subdomain/path) present in `sources[].url`. Mention = brand_name in `answerText` but not in sources. Keep the full `sources` list for storage.
- These modules are **runtime-agnostic** (no Next.js imports) so the Docker scanner can import them directly.

## Step 2.D — Docker scanner on the homelab (Code writes; Ben deploys)

- New folder `scanner/` (kept out of the Next.js build): a small Node entrypoint `scanner/run-scan.ts` that:
  1. Connects to Neon (its own `postgres.js` client + `DATABASE_URL`).
  2. Opens a `scan_runs` row (status `running`).
  3. For each project with active prompts + brand config + a usable key: decrypts the key (`crypto.ts` + `ENCRYPTION_KEY`), queries the engine per prompt, runs the matcher, and `INSERT … ON CONFLICT (prompt_id, engine, day) DO UPDATE` into `citation_results` (idempotent per D5).
  4. Closes the `scan_runs` row (`success` / `partial` / `failed` + counts + error). Never let one prompt's failure abort the run (per-item try/catch, mirroring `github-sync.ts`).
- `scanner/Dockerfile` (node:20-slim, copies the shared `src/lib/citation/*` + `crypto.ts`), `scanner/README.md` with exact homelab steps for node `wyco`: build the image, set env (`DATABASE_URL`, `ENCRYPTION_KEY`, engine keys are read from Neon), and a **twice-weekly cron** (host crontab or a `docker compose` + `ofelia`/system cron). Spell out the directory each command runs in on `wyco`.
- **Why a container, not Vercel Cron:** scans are slow, run third-party LLM calls per prompt, and shouldn't eat Vercel function budget — they belong on hardware Ben owns (spec B.4). This also keeps node-only scanner code out of the webpack bundle (BIPS-L5).

## Step 2.E — `/citations` read UI (Code)

- New `src/app/citations/page.tsx` + `src/lib/citation/queries.ts` (read-only data access; spread rows per BIPS-L4). Project picker (reuse the pill-tab pattern from `/summaries`). Per project show: citation-rate trend over time (cited scans / total scans per window), latest sources list, per-prompt latest status (cited / mentioned / neither). **Every figure carries the "sampled — not an exact count" caveat (B0.8).**
- Add "Citations" to the sidebar nav. No scanning happens here — read-only.

## Step 2.F — Attribution + manual engagement (Code)

- On a posted draft, add a `promoted_url` field (the URL the post drives toward) and an `engagement_manual` paste-in (likes/reposts/comments — stored as jsonb, **no platform API**, per B0.9 / project non-goal).
- Attribution view: for a posted draft promoting URL U, show citation_results for that project's domain/U where `cited` and `scanned_at > posted_at`, plus before/after citation rate around the post date. **Label it a correlation in a small sample, never causal** (B.6).

## Step 2.G — Docs

Update `PROJECT.md` "Shipped recently" + `docs/PLAN.md` (add Phase 2.5) per phase ship. If any new bug class is diagnosed (e.g. Sonar response shape surprises), capture a lesson in `CLAUDE.md`.

### ▶ Code prompt — Campaign 2, checkpoint C (the risky one)

```
Read docs/specs/reddit-and-citation-tracking-spec.md (Part B) and the
implementation plan (Campaign 2). Before writing the parser, do the
pre-flight API audit (WoW L12): make ONE real Perplexity Sonar call with
my key and dump the raw JSON so we build the sources parser on the actual
shape. Then:

1. src/lib/crypto.ts — AES-256-GCM via node:crypto (NO dep), using
   ENCRYPTION_KEY; fail closed if missing.
2. src/lib/citation/engines/types.ts (CitationEngine interface) and
   engines/perplexity.ts (plain fetch, no SDK).
3. src/lib/citation/matcher.ts — cited (domain in sources) vs mentioned
   (brand_name in text, not in sources); keep full sources list.
   Keep all citation modules free of Next.js imports.

Do NOT add any npm dependency. Do NOT call any social-platform API.
Ask me before the schema and before the first real Sonar call (I supply
the key). Report the raw Sonar shape to me before you finalise the parser.
```

---

## Dependency & risk summary (for Ben's sign-off)

- **New npm dependencies: none planned.** HTTP via native `fetch`; crypto via `node:crypto`; DB via the existing `postgres.js`. Per CLAUDE.md rule #8, Code must stop and ask before adding any package (e.g. an engine SDK).
- **New env secret: `ENCRYPTION_KEY`** — `.env.local` + Vercel (Sensitive) + homelab container, all identical. Fail-closed if absent.
- **New infra: one Docker container on node `wyco`** running twice-weekly. No new cloud cost; runs on owned hardware.
- **Biggest unknown:** the exact Perplexity Sonar response shape (D4) — de-risked by the mandatory pre-flight audit before any parser code.
- **Cost:** Perplexity Sonar ≈ pennies/user/month at twice-weekly × a handful of prompts. Anthropic spend rises only modestly (Reddit adds per-sub draft calls; cap subs at 3).
```

