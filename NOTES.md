# Session log

Append-only. Newest entry at the top.

---

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
