# Spec — Per-project Reddit defaults + auto-generation

*Status: **v1 shipped 2026-06-21 — DASHBOARD PATH ONLY** (cron half deferred per open question 1). Author: Cowork. Date: 2026-06-20. Extends Phase 1.5c (Reddit drafting).*
*Decisions locked with Ben: (1) separate per-repo Reddit pass, (2) keep the per-moment picker as an override.*

---

## Problem

Reddit drafting works but is clunky: the user re-selects subreddits on every moment's Reddit tab. The selection is really a per-project preference, not a per-moment one. Goal: choose the target subs **once per project in Settings**, and have the normal Generate run produce Reddit drafts automatically for those subs — no per-moment picking for the common case.

## Behaviour

1. **Settings — per-project sub selection.** Each watched repo gets a Reddit sub multi-select (the four curated subs). Stored as a namespaced `reddit.subs.<repo>` key in the existing `settings` table (JSON array of slugs). **Unset/empty = Reddit auto-gen OFF for that repo** (opt-in — repos you don't want Reddit for cost nothing). Capped at `MAX_SUBS_PER_GENERATE` (3).
2. **Auto-generation.** When a repo is generated (dashboard or cron), after its moments + X/IH drafts are saved, a **separate, bounded Reddit pass** generates one tailored draft per (new moment × selected sub) for that repo. Reuses `draftRedditForSub` and the journey-format/banned-words/`[VERIFY]` guards unchanged.
3. **Manual picker stays.** The per-moment Reddit tab remains as an override — add a one-off sub or regenerate for a specific moment. It already only offers subs that don't yet have a draft, so auto-generated subs simply show as existing drafts.

## Decisions (locked)

- **Separate per-repo Reddit pass**, not inline in `generateDrafts`. Rationale: the project already split generation per-repo to fit Vercel's 60s limit, and the per-repo path has a 90s guard. Adding Reddit inline would re-pressure those budgets. A separate bounded pass keeps each unit of work small.
- **Keep the per-moment manual picker** as an override (no behaviour lost).
- **Opt-in** (empty selection = off) and **3-sub cap** to bound token spend and latency.

## Data model

No schema migration needed — reuse the `settings` key-value table.

- Key: `reddit.subs.<repo>` → JSON array of sub slugs, e.g. `["SaaS","SideProject"]`. Absent/`[]` = off.
- New helpers in `src/lib/settings.ts`: `getRedditSubs(repo): SubSlug[]` and `setRedditSubs(repo, subs)`, validating against `SUB_SLUGS` and capping at `MAX_SUBS_PER_GENERATE`.

Reddit drafts themselves use the existing `drafts` schema (`variant='reddit'`, `subreddit`, `title`) from migration 0004 Part A — no change.

## Design

**New function** `generateRedditForRepo(repo: string, generationId: string)` in `claude.ts` (reuses `draftRedditForSub`):

1. `subs = getRedditSubs(repo)`. If empty → return `{ count: 0 }` (no-op, no Claude calls).
2. `moments = getMomentsByGeneration(generationId)` — the moments just produced for this repo's run.
3. For each (moment × sub): `draftRedditForSub(...)` in parallel, then `deleteRedditDraftsForSub` + `insertRedditDraft` (same persistence as the on-demand path — replaces a still-`draft` row, never clobbers approved/posted).
4. Wrap the whole pass in the existing `withTimeout` helper; the 3-sub cap + opt-in keep the call count bounded.

**Wiring:**

- **Dashboard (primary, reliable path).** The Generate button loops repos sequentially, one server-action call per repo. Add a second bounded call per repo — `generateRedditForRepoAction(repo, generationId)` — fired right after `generateForRepoAction(repo)` returns its `generationId`. Each call is its own invocation with its own budget; the per-repo status row can show a "drafting Reddit…" sub-step. The client already continues on a failed repo, so a Reddit-pass failure won't block the queue.
- **Cron.** Call `generateRedditForRepo(repo, generationId)` inside the existing per-repo loop after `generateDrafts`. **Caveat / open question (see below):** the cron loops *all* repos in one 60s invocation today, so adding Reddit increases time pressure on an already-tight budget. Resolve before shipping the cron half.

## Acceptance criteria

- [ ] Settings shows a per-repo Reddit sub selector; selecting persists to `reddit.subs.<repo>` and survives reload. Cap of 3 enforced in the UI and the setter.
- [ ] With subs selected for a repo, clicking Generate produces moments + X/IH **and** one Reddit draft per (moment × selected sub), each under the correct sub, visible in the moment's Reddit tab.
- [ ] With **no** subs selected for a repo, Generate makes zero Reddit calls for it (cost-neutral vs today).
- [ ] The per-moment manual picker still works for subs not already drafted.
- [ ] A Reddit-pass failure/timeout for one repo surfaces as a status and does **not** block other repos (Bug-Diagnosis hardening from the timeout fix carries over).
- [ ] `npx tsc --noEmit` + `npm run lint` clean. No new npm dependency.

## Open questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | **Cron 60s budget.** The cron loops all repos in one `maxDuration=60` invocation; adding a Reddit pass per repo worsens existing time pressure (this is a pre-existing constraint, not introduced here). Options: ship Reddit auto-gen on the **dashboard path only** for v1 and defer cron, or cap moments/subs harder on cron, or fix the cron to not loop all repos in one invocation (separate follow-up). **→ RESOLVED for v1: dashboard-only; cron untouched. Revisit when the cron's per-invocation budget is addressed.** | Ben / eng | ~~Yes for the cron half~~ (deferred) |
| 2 | Default for newly-added repos — confirm **off** (empty) so adding a repo never silently starts spending on Reddit. Recommended: off. | Ben | No |
| 3 | Should the moment card visually distinguish auto-generated subs from manually-added ones? Recommended: not for v1 (a draft is a draft). | Ben | No |

## Phased build (for the Code prompt)

1. `settings.ts` — `getRedditSubs` / `setRedditSubs` helpers (+ validation + cap).
2. Settings page — per-repo Reddit sub selector (reuse the sub-pill UI from the moment card).
3. `claude.ts` — `generateRedditForRepo(repo, generationId)` reusing `draftRedditForSub` + `getMomentsByGeneration`, wrapped in `withTimeout`.
4. `dashboard-actions.ts` — `generateRedditForRepoAction(repo, generationId)`; button fires it per repo after the main generate.
5. Cron — wire per repo **only after open question 1 is resolved** (default v1: dashboard-only, cron deferred).
6. Docs — update `PROJECT.md` "Shipped recently" + this spec's status in the same commit.
