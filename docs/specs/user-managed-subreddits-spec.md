# Spec — User-managed subreddit catalog

*Status: **shipped 2026-06-21** (migration 0005 applied; catalog data layer, Settings CRUD, catalog-driven selection, and generation fallback all live). Author: Cowork. Date: 2026-06-21. Extends Phase 1.5c Reddit drafting + the per-project auto-gen spec.*
*Decisions locked with Ben: (1) name-only adds — rule fields optional with generic fallback; (2) global catalog, per-project selection.*

---

## Problem

The four subreddits are hardcoded in `src/lib/reddit-subs.ts` and pinned by a `CHECK` constraint on `drafts.subreddit`. Adding a new sub (e.g. r/webdev, a niche community) currently needs a code change + migration. The user wants to add/edit/remove subreddits from the UI, no code change.

## Behaviour

1. **Subreddit catalog (global).** A new `subreddits` table holds every sub the user can target, shared across all projects. The four curated subs are seeded into it on first run, preserving their existing tone/rules.
2. **Manage in Settings.** A "Manage subreddits" area: add, edit, remove. **Adding requires only the subreddit name**; tone note, self-promo rule, pre-post checklist, and flair hint are optional. `submit_url` is derived from the name. The per-project selector and the per-moment picker then list the catalog (curated + user-added) instead of a fixed four.
3. **Graceful fallback.** When a sub's optional fields are blank: generation uses a generic journey-format steer (no per-sub tone line), and the moment card hides the checklist/rules block for that sub. A bare sub still produces a draft.
4. **Everything else unchanged.** Per-project selection (`reddit.subs.<repo>`), the 3-subs-per-project cap, journey format, banned words, `[VERIFY]`, no auto-publish, and the on-demand per-moment override all stay.

## Decisions (locked)

- **Name-only adds**, rule fields optional. Frictionless; the trade-off is that a bare sub loses the mod-filter safety the curated subs have — acceptable, and the UI nudges (placeholder text) toward filling the self-promo rule.
- **Global catalog + per-project selection** — define a sub once, select it per project. Matches today's selection model.

## Data model

Migration `migrations/0005_subreddits_catalog.sql` (parses clean against the PG grammar):

- New **`subreddits`** table: `id`, `slug` (unique, e.g. "webdev"), `display_name` ("r/webdev"), optional `tone_note`, `self_promo_rule`, `prepost_checklist` (jsonb array), `flair_hint`, timestamps. `submit_url` derived in-app, not stored.
- **Drop** `drafts_subreddit_check` (the fixed four-slug enum from 0004). **Keep** `drafts_reddit_subreddit_check` (variant↔subreddit consistency).
- Add a light `drafts_subreddit_format_check` (`^[A-Za-z0-9_]{1,50}$`) so a malformed slug (e.g. an "r/" prefix) can't land.
- **No FK** `drafts.subreddit → subreddits.slug`: removing a sub from the catalog must never delete or orphan historical drafts.

## Code shift (the bulk of the work)

This converts compile-time constants into runtime data — a mechanical but cross-file change (9 files import the current config):

- **`SubSlug` union → `string` slug**, validated at runtime against the catalog. Lose compile-time exhaustiveness; gain user-managed flexibility (inherent trade-off).
- **`SUBREDDIT_RULES` static map → DB loads.** New `src/lib/subreddits.ts`: `getSubreddits()`, `getSubredditBySlug(slug)`, `createSubreddit`, `updateSubreddit`, `deleteSubreddit`, `submitUrlFor(slug)`, with slug validation/dedupe.
- **Client components get sub data as props.** `moment-card.tsx` and `copy-open-flow.tsx` currently import the static map directly (it was isomorphic). They can't read the DB, so a server component loads the catalog and passes it down. This is the main refactor.
- **`reddit-subs.ts` becomes the seed source.** Keep its content as `DEFAULT_SUBREDDITS` and seed via an idempotent `seedDefaultSubreddits()` (`INSERT … ON CONFLICT (slug) DO NOTHING`) so the curated four keep their exact rules; drop the `SubSlug` union from it.
- **Generation** (`draftRedditForSub`, `generateRedditForRepo`) reads tone/rules from the catalog with the generic fallback.

## Acceptance criteria

- [ ] Settings "Manage subreddits": add a sub with just a name → it appears in the catalog and is selectable per project; edit and remove work.
- [ ] Adding a sub with optional tone/rule/checklist filled → those drive the draft + show in the moment card; left blank → draft still generates (generic steer), checklist block hidden.
- [ ] The four curated subs are present after migration with their original rules (seeded), and existing Reddit drafts still render.
- [ ] Per-project selection, the 3-cap, and the per-moment override all still work against the dynamic list.
- [ ] Removing a sub from the catalog does not delete or break historical drafts that used it.
- [ ] `npx tsc --noEmit` + `npm run lint` clean. No new npm dependency.

## Open questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | Slug normalisation — strip a leading "r/" and lowercase-compare on input so "r/WebDev" and "webdev" don't both get added? Recommended: normalise to the bare slug, keep display_name as entered. | eng | No |
| 2 | Removing a sub that's currently selected by a project — silently drop it from that project's `reddit.subs.<repo>`, or warn? Recommended: drop + a small "was removed" note. | Ben | No |
| 3 | Cap raise — now that the catalog can grow, keep the 3-subs-per-project cap or raise it? Recommended: keep 3 for cost/latency; revisit later. | Ben | No |

## Phased build (for the Code prompt)

1. Migration 0005 (Ben applies in Neon).
2. `src/lib/subreddits.ts` — catalog data layer + validation + `submitUrlFor`.
3. Seed: `DEFAULT_SUBREDDITS` (ported from `reddit-subs.ts`) + idempotent `seedDefaultSubreddits()`.
4. Replace `SubSlug`/`SUBREDDIT_RULES` usages with the catalog; pass sub data into client components as props.
5. Settings — "Manage subreddits" CRUD UI; per-project selector now lists the catalog.
6. Generation — `draftRedditForSub`/`generateRedditForRepo` read catalog rules with generic fallback.
7. Docs — `PROJECT.md` "Shipped recently" + flip this spec's status, same commit.
