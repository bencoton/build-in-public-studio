# Spec — Humanizer pass (`humanize()`)

**Status:** Draft for review · **Author:** drafted in Cowork · **Date:** 2026-06-25
**Type:** Feature spec / PRD
**Source workflows:** r/ClaudeCode "Humanizer" two-pass skill (W1) + r/ClaudeAI "90k-post AI-slop" data study (W2)

> Decision baked into this draft (changeable): build as a **standalone, app-agnostic `humanize()` module** (Option A), run **on-demand** (off the weekly cron path) for v1. Rationale in §Constraints.

---

## Problem Statement

Build-in-Public Studio generates X, Indie Hackers, and Reddit drafts with Claude. The draft prompt already bans some words and steers voice, but it does this in a single generation pass — there is no dedicated step that *detects and removes* the stylistic "AI tells" (em-dash overuse, flat sentence rhythm, "not just X, it's Y" constructions, sycophantic openers, rigid structure) that readers most associate with machine-written text. Drafts that read as AI undercut the product's core credibility hook ("100% Claude-generated, shipping in public"). The same gap exists in any other app the author builds that emits AI text, so the fix should be reusable, not app-specific.

## Goals

1. **Reduce measurable AI tells** in any text passed through it — target a meaningful drop in tell-count on a fixed test set (see Success Metrics), without changing the text's meaning or facts.
2. **Preserve and strengthen voice** by reusing the author's existing voice signals (starred examples, style notes, banned words) rather than inventing a generic voice.
3. **Be reusable across apps** — a single importable function with no dependency on Build-in-Public Studio's database or domain types.
4. **Respect the existing serverless budget** — never push the weekly cron generation past the Vercel function cap.
5. **Make improvement objective** — ship a way to count tells before/after so quality is measured, not asserted (closes W2's "no before/after example" gap).

## Non-Goals

1. **Auto-running on every weekly cron draft (v1).** The full multi-pass humanizer across 10+ drafts won't fit the 60s cap; v1 runs on-demand only. Folding it into the cron path is a P2 once per-call cost/latency is known.
2. **A user-facing "humanize" UI beyond a single trigger.** v1 exposes one action (button/route); rich diff UI, per-tell toggles, and settings are P1/P2.
3. **Replacing the existing draft prompt.** `humanize()` runs *after* generation; the existing `DRAFT_SYSTEM_PROMPT` voice rules stay as the first line of defense.
4. **A general writing assistant.** Scope is tells-removal + voice-fit on already-generated drafts, not open-ended editing or ideation.
5. **Auto-publishing.** Out of scope here and forbidden by project rule — humans stay in the loop.

## Background — what already exists in the codebase

The app is ~half a humanizer already, which shrinks this build:

- `src/prompts/draft-system.ts` — `DRAFT_SYSTEM_PROMPT` already bans `revolutionize/leverage/unlock/delve`, fake-intimacy openers, and steers "specific over generic."
- `src/lib/settings.ts` — `getBannedWords()`, `getStyleNotes()` (user-configurable).
- `src/lib/history.ts` — `getStarredExamples()` feeds starred past posts as a few-shot voice signal (this is W2's "give it a sample of your writing", already wired).
- `src/lib/claude.ts` / `src/lib/claude-regenerate.ts` — every output path (`draftMoment`, `draftRedditForSub`, `regenerateDraft`) generates text, returns it, then persists. **The seam for `humanize()` is between generate and persist.**

## User Stories

- As a **solo dev reviewing a draft**, I want to run a humanize pass on a single draft so that it reads less like AI before I post it.
- As a **solo dev**, I want the humanized version to still sound like *me* (my starred examples and style), not a generic "human voice," so that it's consistent with my other posts.
- As a **solo dev**, I want to see that the pass actually removed tells (a count or short change list) so that I trust it did something and can spot over-editing.
- As a **developer of another app** (any app emitting AI text), I want to import `humanize(text, options)` with no Build-in-Public-Studio dependencies so that I can reuse it.
- Edge: As a **user with a very long draft**, I want the pass to handle it without truncation or blowing the function timeout, so that long IH posts still work.
- Edge: As a **user**, I want facts/numbers and `[VERIFY]` markers preserved, so that humanizing never invents or launders specifics.

## The `humanize()` contract (P0)

A pure, app-agnostic module — proposed `src/lib/humanize.ts`, importable elsewhere with zero domain imports.

```ts
export type HumanizeOptions = {
  apiKey: string;                 // caller supplies; no env coupling
  voiceExamples?: string[];       // raw strings; caller maps its own types
  bannedWords?: string[];         // merged with the built-in ranked catalog
  styleNotes?: string;
  passes?: ("voice" | "tells")[]; // default ["tells"]; ["voice","tells"] = full
  audit?: boolean;                 // default true — self-audit + final rewrite
  format?: "x_thread" | "ih_long" | "reddit" | "plain"; // light format guardrails
  model?: string;                 // default the app's Sonnet model
  signal?: AbortSignal;           // honor caller timeouts
};

export type HumanizeResult = {
  text: string;
  tellsBefore: number;            // from the deterministic scanner (§Verification)
  tellsAfter: number;
  changes: string[];              // short human-readable change list
  usage: { inputTokens; outputTokens; cacheReadTokens; cacheCreationTokens };
};

export async function humanize(text: string, opts: HumanizeOptions): Promise<HumanizeResult>;
```

Design notes: returns token usage in the same shape the app already aggregates; takes `apiKey` rather than reading env so it's reusable; `passes`/`audit` toggles let short drafts skip expensive work to control latency/cost.

## Requirements

### Must-Have (P0)

1. **Merged, evidence-ranked tells catalog** (see Appendix A) baked into the module, ordered by W2's citation frequency. Acceptance: catalog covers every W1 category and every W2 ranked tell, deduped, each with a one-line fix.
2. **Tells pass** — one Claude call that rewrites the input to remove catalog tells while preserving meaning, facts, and `[VERIFY]` markers.
   - Given a draft containing em-dashes / "not just X, it's Y" / a sycophantic opener, When `humanize()` runs with default opts, Then those constructions are reduced/removed and no facts or numbers change.
3. **Voice pass (toggleable)** — when `passes` includes `"voice"`, a pass that adds first-person, opinion, rhythm variation, and specific detail, calibrated to `voiceExamples`/`styleNotes`. Off by default to control cost.
4. **Self-audit + final rewrite (toggleable, default on)** — Claude answers "what would still tip a reader off?" then does one corrective rewrite (W1 step 5–6).
5. **Deterministic tell scanner** — a regex/heuristic counter (adapted from W2's GitHub scanner) producing `tellsBefore`/`tellsAfter`. Pure JS, no Claude call. Acceptance: counts are reproducible for identical input.
6. **App-agnostic** — module imports nothing from `src/lib/*` domain code (no DB, no settings, no moment types). Acceptance: `humanize.ts` compiles in isolation.
7. **On-demand integration** — one trigger in the app (a "Humanize" action on the draft view, reusing the regenerate path's plumbing) that loads voice examples/banned words/style notes, calls `humanize()`, and persists the result like a regenerate.

### Nice-to-Have (P1)

1. **Before/after diff view** in the UI (not just a count).
2. **Per-format guardrails** (e.g. keep X tweets <280 chars, preserve numbered thread structure) enforced post-pass.
3. **Settings toggle** for default passes (tells-only vs full) and audit on/off.
4. **Chunking for long drafts** — split IH long-form by paragraph, humanize per chunk, reassemble.

### Future Considerations (P2)

1. **Cron-path integration** — auto-humanize during weekly generation once per-call latency/cost is measured and parallelization fits the cap.
2. **Publish `humanize()` as a shared internal package** for other apps (vs copy-import).
3. **Catalog refresh job** — periodically re-derive tell rankings from fresh data (W2's reproducible-research angle).

## Success Metrics

**Leading (days):**
- **Tell reduction:** on a fixed 20-draft test set, median `tellsAfter` is at least 50% below `tellsBefore` (success) / 70% (stretch). Measured by the deterministic scanner.
- **Meaning preservation:** 0 fact/number changes and 0 dropped `[VERIFY]` markers across the test set (manual spot-check of all 20).
- **Latency:** single-draft on-demand humanize completes within the existing per-call timeout (60s) at default opts.

**Lagging (weeks):**
- **Adoption:** author runs humanize on a majority of drafts before posting (self-reported / simple counter).
- **Reuse:** the module is imported by ≥1 other app without modification.

## Open Questions

1. **(Author)** Default passes for v1 — tells-only (cheaper, safer) or full voice+tells? Draft assumes tells-only default, full available via opts.
2. **(Eng)** Does the standalone module re-cache its own system prompt, or is caching irrelevant given on-demand single calls? Leaning: skip cache complexity in v1.
3. **(Eng/Author — non-blocking)** Where exactly does the UI trigger live — on each variant card, or a batch action on a generation? Draft assumes per-variant, reusing regenerate plumbing.
4. **(Author — non-blocking)** New dependency check: the scanner is pure regex (no dep). Confirm no new npm dep is wanted; per project rule, adding one is an "ask first" event. Draft assumes **zero new deps**.

## Timeline / Phasing

- **Phase 1 (P0):** `humanize.ts` module (catalog + tells pass + audit + scanner) + unit-ish verification on the test set. No UI.
- **Phase 2 (P0):** wire the on-demand trigger into the draft view via the regenerate path.
- **Phase 3 (P1):** diff view, format guardrails, chunking, settings toggle.
- **Phase 4 (P2):** cron-path integration once Phase 1–2 latency/cost is known.

No hard external deadline. Dependency: none beyond the existing Anthropic SDK.

---

## Appendix A — Merged evidence-ranked tells catalog

Ordered by W2's citation frequency (≈90k posts), mapped onto W1's categories. Each tell has a one-line fix the Tells pass applies.

**Cosmetic / punctuation**
1. **Em-dash overuse** → prefer commas, periods, or parentheses; cap em-dashes per paragraph.
2. **Uniform paragraph/sentence length (metronomic rhythm)** → vary sentence length deliberately; allow fragments.

**Structural**
3. **Rigid intro–body–conclusion mold** → let structure follow the argument; drop the wrap-up paragraph.
4. **Predictable listicle/triad scaffolding** ("There are three reasons…") → use only when the content genuinely is a list.

**Conversational artifacts**
5. **Sycophantic openers** ("Great question!", "I'm excited to share") → cut; open on a concrete detail. (Already partly in `DRAFT_SYSTEM_PROMPT`.)
6. **Missing contractions / stiff register** → use contractions; match the platform's casualness.

**Fake depth / inflated importance** (W1 categories)
7. **"Not just X, it's Y" / antithetical see-saw** → state the point directly.
8. **Inflated importance** ("This is a game-changer", "fundamentally transforms") → downgrade to what actually happened.
9. **Hollow profundity** (grand closing abstractions) → end on the specific, not the sweeping.

**Diction memes**
10. **Banned/overused words:** `delve, leverage, seamless, tapestry, revolutionize, unlock, robust, navigate (figurative), realm` → plain synonyms. Merged with the app's existing list + user `bannedWords`.

> The Voice pass *adds* (opinion, first person, mixed feelings, specific detail) using `voiceExamples`/`styleNotes`; the Tells pass *removes* the above. The audit catches residue.

## Appendix B — Verification step (required before merge)

1. Assemble a 20-draft test set from real app output (X / IH / Reddit mix).
2. Run the deterministic scanner to record `tellsBefore`.
3. Run `humanize()` at default opts; record `tellsAfter` and inspect `changes`.
4. Manually confirm: no fact/number altered, no `[VERIFY]` dropped, format intact.
5. Pass bar: median ≥50% tell reduction AND 0 meaning regressions. Log results in `NOTES.md`.
