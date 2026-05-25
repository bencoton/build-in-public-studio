# Ways of Working

*A reusable workflow playbook for new projects — by Ben (WyCo)*

**Last updated:** 24 May 2026
**Status:** Living document — append new rules and lessons as you learn them. Do not delete old ones.

## Two facts that frame everything below

1. **100% of code in WyCo projects is Claude-generated.** Either Claude Code (CLI, default) or Cowork (Claude desktop app, when planning bleeds into a small code change). Ben does not hand-write production code. This is a deliberate choice — it makes the AI-collaboration rules in this document load-bearing, not optional. When Claude is asked to "fix this", it is Claude fixing its own previous output; clarity, lessons capture, and the diagnostic loop matter more, not less.
2. **Every project lives in its own private GitHub repo.** One folder under `C:\Users\benco\code\<project-name>`, one git repo, one GitHub origin. No mono-repos, no shared "utilities" repo. Cross-project consistency comes from the docs (this file + `Tech-Stack.md` + `WYCO-DIGITAL-STYLE-GUIDE.md` + the `PROJECT.md` schema in Part 13), not from shared code.

---

## How to use this document

1. **Copy this file** (and its companion `Tech-Stack.md`) into the `docs/` folder of every new project.
2. **Drop a copy of the key rules** into a `CLAUDE.md` at the project root so both Cowork and Claude Code pick them up automatically.
3. **The Lessons section (Part 9) is the most valuable part** — do not delete it. Append to it as new bugs get diagnosed.
4. **Visual branding** lives in [`WYCO-DIGITAL-STYLE-GUIDE.md`](./WYCO-DIGITAL-STYLE-GUIDE.md) (this folder). Reference it whenever you are about to build UI, write marketing copy, or pick a colour — do not re-decide visual design per project.

---

## Part 1 — How I want Claude to work with me

The collaboration baseline. Both Cowork and Claude Code follow these.

- I am a **beginner-leaning developer** with backend / scripting experience. Mobile development is newer to me. Assume that, and explain things clearly.
- **Give complete how-to guides.** Do not skip steps because they "seem obvious". If a command needs to run in a specific directory, say which directory.
- **Suggest, do not assume.** When you are about to add a library, install a tool, change architecture, or rename something used in more than one place — ask first if the change is non-trivial.
- **Prefer fewer dependencies.** If a feature can be done with libraries already installed, do it that way. Adding a dependency is a decision, not a default.
- **Small, reversible changes.** One concern per commit. If a refactor and a feature show up in the same diff, split them.
- **Flag vibe-coding rot.** A file that has grown too long, a name that no longer matches the behaviour, two near-identical functions — say so. "This file is getting long; want me to split it?" is welcome.
- **Always commit and push after each meaningful change.** Use clear, conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- **End each session by updating `NOTES.md`** (an append-only log) with what changed and what is next. Future sessions read it before doing anything.

---

## Part 2 — The two AI tools and how they hand off

You use two Claude products in tandem. They overlap but lean into different jobs.

| | **Cowork** (Claude desktop app) | **Claude Code** (CLI in terminal) |
|---|---|---|
| **Strong at** | Strategy, planning, research, writing docs, brainstorming, debugging *in conversation* | Writing code, running commands, editing files, version control, deploying |
| **Weak at** | Multi-file structural code changes; running your dev server | Stepping back and questioning whether the plan is right |
| **Persists via** | Memory + the docs folder | The codebase (via git) + the docs Cowork wrote |
| **Talk to it like** | A product partner / thinking colleague | A junior engineer who needs precise instructions |

**Mental model:** *Cowork plans, Claude Code implements.* They share state through the project folder.

### Default zones

- **Cowork normally writes:** `docs/*.md`, the lessons section of `CLAUDE.md`, marketing copy, prompts, plans.
- **Claude Code normally writes:** source code (`src/`, `supabase/`, etc.), commits, pushes.
- **Either can touch the other zone** when it makes sense — no fence. Claude Code can append a lesson to `CLAUDE.md`; Cowork can draft a `README.md`.

### When to use which (quick reference)

| Situation | Tool | Why |
|---|---|---|
| "Should I add feature X?" | **Cowork** | Strategy. |
| "Run the database migration" | **Claude Code** | Writes SQL, runs CLI, commits. |
| "I got a TypeScript error I don't understand" | **Cowork first**, then Claude Code | Plain-English diagnosis first, then surgical fix. |
| "Name the next product" | **Cowork** | Naming / brand. |
| "Refactor across many files" | **Claude Code** | Multi-file code change. |
| "Draft the closed-beta email" | **Cowork** | Copy. |
| "Stuck in a fix-and-pray loop" | **Cowork** | Step out, get unstuck. |
| "Plan + implement eBay OAuth" | **Both** | Cowork explains the flow; Claude Code writes it. |

When in doubt: ask Cowork. If it is a code change, it will redirect you to Claude Code. The reverse is less true by default — Claude Code tends to charge ahead with code even when stepping back would help. The handoff protocol below fixes that.

### Handoff protocol — recommend, don't fight

The most important rule of the two-tool setup. Without it, the tools fight for attention: Cowork tries to drive a multi-file refactor through its sandbox (slow and sometimes flaky); Claude Code tries to run a strategic conversation it should hand back to Cowork (charges ahead with code instead of thinking).

**Both tools follow the same rule:** when the current request is better served by the OTHER tool, stop, name the handoff, offer to draft the prompt for the other tool, and wait for the user's green light. Drafting the handoff is not a failure — it is doing the job well. The user can always override with "no, do it here anyway".

**Cowork → Claude Code triggers.** Cowork should recommend handing off whenever:

- A code change touches more than one file.
- Any git operation is involved (commit, push, branch, restore).
- The user wants to run the dev server, install packages, run a migration, or scaffold something.
- Anything needs the user's real auth (gh, Vercel CLI, Supabase CLI, npm publish).
- The conversation has converged on a specific, actionable code change — Cowork has done the thinking; Claude Code should do the doing.

**Claude Code → Cowork triggers.** Claude Code should recommend handing off whenever:

- The user asks a strategic question ("should I build X?", "which feature first?", "is this the right architecture?").
- The user wants market research, competitive analysis, naming, copywriting, or branding work.
- The job needs reading and synthesising more than 2–3 docs to answer.
- The user is two or more failed-fix attempts deep on the same bug — that is the "fix-and-pray loop" anti-pattern from Part 8. Stop and hand the situation back to Cowork for a plain-English second opinion.
- The job needs a Cowork-only connector or skill (Slack, Notion, Gong, Granola, brand-voice, data-analysis skills, the cross-project social-update workflow in Part 13).
- An error message is genuinely mysterious and a fresh perspective would help more than another speculative fix.

**Standard handoff phrases** (use these verbatim or close to it — consistency helps the user recognise the moment):

- *Cowork → Claude Code:* "**This is shell/code work — better done in Claude Code.** Here is the exact prompt to paste: [block]. Run it, then paste me what came out so I can keep the plan current."
- *Claude Code → Cowork:* "**This is a thinking task — better done in Cowork.** Stop here, switch over to Cowork, and ask: '[suggested question]'. Then come back to me with the decision and I'll implement it."

**Tone matters.** The handoff is matter-of-fact, not apologetic. "This is Claude Code's job because X" — not "sorry, I can't really do this." The user is paying both tools to know their lane; saying so is the work.

**One important exception.** If the user explicitly says "do it here anyway" or "stay in this tool", drop the recommendation and proceed. The protocol's job is to surface the option, not to refuse work.

### Standard session shapes

1. **Planning** (Cowork) — "What should Phase 2 look like?"
2. **Build** (Claude Code) — "Implement Session 3."
3. **Research** (Cowork) — "What are competitors doing?"
4. **Debug** (mostly Cowork) — "Something is broken — help me diagnose."
5. **Retro** (Cowork) — "Phase 1 done — what next?"

---

## Part 3 — Project setup standards

Every new project should be set up the same way so you stop relearning the basics.

### Folder + repo conventions

- **One folder, one git repo.** Cowork and Claude Code share the same selected folder. No separate docs repo.
- Project root lives under `C:\Users\benco\code\<project-name>`.
- Source under `src/` (web) or `app/` (Expo), database under `supabase/`, planning docs under `docs/`.
- `CLAUDE.md` lives at the project root on day one. Both tools read it automatically.
- Include a "User" section in `CLAUDE.md` that flags you are a beginner and need complete how-to guides.

### Day-one checklist for a new project

- [ ] Create empty folder at `C:\Users\benco\code\<project-name>`. (All projects live under this parent so the AI-driven cross-project workflows in Part 13 can walk them.)
- [ ] Run `git init`, **create a NEW private GitHub repo for this project alone** (no mono-repos, no shared utilities repos), push first commit.
- [ ] Copy this `Ways-of-Working.md`, `Tech-Stack.md`, and `WYCO-DIGITAL-STYLE-GUIDE.md` into `docs/`.
- [ ] Copy `PROJECT-TEMPLATE.md` from this folder into the project root as `PROJECT.md` and fill in the frontmatter (see Part 13).
- [ ] Create `CLAUDE.md` at the root — paste in the workflow rules + the relevant lessons from Part 9.
- [ ] Connect the folder to Cowork (Cowork → Open folder).
- [ ] Open the folder in Claude Code and run `/init` so it indexes the codebase.
- [ ] Scaffold the stack from `Tech-Stack.md` (Next.js or Expo, Supabase link, Vercel link, etc.).
- [ ] Push first deploy to confirm the whole pipeline is green before writing any feature code.
- [ ] Create empty `NOTES.md` and `KNOWN-ISSUES.md` at the root.
- [ ] **Decide the default UI theme — light or dark.** Claude should ask this on day one before any UI code is written, because retrofitting a theme later means revisiting every component. Record the answer in `CLAUDE.md` and reflect it in the Tailwind / NativeWind config and the colour tokens pulled from [`WYCO-DIGITAL-STYLE-GUIDE.md`](./WYCO-DIGITAL-STYLE-GUIDE.md). If both modes are required, pick which one is the default and which is the toggle.

### Required project memory files

Every project gets these files at the root:

- **`PROJECT.md`** — structured metadata + rolling "shipped recently" log. Read by AI agents to produce cross-project summaries (see Part 13). Schema is in [`PROJECT-TEMPLATE.md`](./PROJECT-TEMPLATE.md).
- **`NOTES.md`** — append-only freeform session log. Short entry at the end of every session. What changed, what was learned, what is next. Future Claude reads this first.
- **`KNOWN-ISSUES.md`** — two sections: `Open` and `Resolved`. Move items between them as they are fixed.
- **`CLAUDE.md`** — project rules, architectural decisions, lessons learned. The single source of truth for "how this project works".

These four files are sacred. They are how Claude (and future me) remember what happened — and how a cross-project AI agent (Cowork) finds enough signal to write a social-media update without re-interviewing me.

---

## Part 4 — Workflow rules (Cowork + Claude Code)

**One folder, one repo.** Both tools share the same selected folder.

**Auto-push policy.** After every clean commit (TypeScript compile passes, ESLint passes, any tests pass), Claude Code pushes to `origin/main` without asking. Vercel auto-deploys on push. You verify prod once the deploy goes green. Only ask before pushing if the commit should NOT auto-deploy yet — e.g. a half-finished schema change, or a destructive migration that has not been smoke-tested against dev.

**Single state-of-the-world check at session start.** Before drafting any prompt or making any code change, Claude Code reports current git state: `git status` and `git log --oneline -5`. No path, filename, or feature is asserted from memory — always from the working tree.

**Planning vs. doing split.** Cowork plans (strategy, research, prompts, docs); Claude Code does (writes code, runs commands, commits, pushes). When in doubt, Cowork drafts the prompt, you paste it to Claude Code, Claude Code executes.

**Generated TypeScript types** from `supabase gen types typescript` land at `src/types/database.ts` by default — not `supabase.ts`. Use that name in prompts.

---

## Part 5 — Decision protocol (when to ask vs when to act)

### Just do it

- Fixing a clear bug whose root cause is obvious from the code.
- Typos, formatting, lint, type errors, dead imports.
- Adding a missing test or piece of telemetry for code that already exists.
- Refactors that do not change behaviour and stay inside a single file.

### Ask first

- Adding a new dependency, even if it looks small.
- Changing the file/folder structure or introducing a new architectural layer.
- Anything that touches secrets, auth, billing, or the database schema.
- Anything that rewrites a file from scratch versus editing it.
- Anything that involves calling a third-party API for the first time in a project.
- **Default UI theme (light vs dark).** Ask on day one before any UI code is written. Do not assume — the answer drives every component, the colour-token mapping, and whether a theme toggle is in scope.

### Stop and tell me

- Something looks dangerous (deleting tables, dropping columns, force-pushing).
- Tests are failing and the fix would change observable behaviour.
- You discover a hidden side effect — a default retry, a silent fallback, a cache — that changes the design.
- Two sources of truth disagree (e.g. the deployed app and the source code).

---

## Part 6 — Commits, branches, and pushes

### Commit message style

Conventional commit prefix + a short, present-tense summary. Body if needed.

- `feat: add Land Registry comparable sales to ARV cascade`
- `fix: stop analyse-property silent-truncating at max_tokens`
- `chore: bump @anthropic-ai/sdk to latest minor`
- `docs: add Rule 32 (pre-flight API-shape audit)`
- `refactor: extract photo classification into lib/photo-classification.ts`

### When to commit

- After each meaningful change — do not batch a sprint into one commit.
- Before starting an unrelated task, even if mid-flight; small WIP commits are fine.
- Before any risky operation (dependency change, schema migration, large rename).

### Push cadence

- Push after every commit unless I have explicitly said the work is local-only.
- If a push would trigger a deploy, mention that out loud before pushing.

---

## Part 7 — Bug Diagnosis Loop

When a bug is reported (anything from "the button is not working" to "the page is blank"), **do not jump straight to a fix.** Work through the loop below in order. Each step's output narrows the next step's scope. Never propose a fix until the data has narrowed the cause to one or two possibilities.

This pattern has been refined across multiple real diagnoses. Skipping steps costs hours of wasted Claude Code time.

### Step 1 — Capture the symptom (not the cause)

The user says what they *see* ("the button is not working", "the page is blank", "it is stuck on loading"). They almost never know the underlying cause. Do not assume they do.

- **Anti-pattern:** "The user said the button is broken, so I will fix the button." Often the button is fine; the data behind it is missing, or the upstream API failed silently.
- **Do this instead:** Treat every symptom report as a starting hypothesis to be tested, not a fact to act on.

### Step 2 — Decompose the symptom into possible causes

Before any diagnostic, list **3–5 plausible causes** for the symptom, ordered by likelihood from cheapest-to-check to most-expensive.

Example for "background task is not running":

1. The task service / function is not deployed at all.
2. The service is deployed but rejecting calls at the auth layer.
3. The service runs but errors silently during execution.
4. The dispatch from the caller is misconfigured.
5. The service runs successfully but writes to the wrong location.

**Why this matters:** Without this list, you will fix the first thing that sounds plausible — which is often wrong. With the list, you design diagnostics that distinguish between them.

### Step 3 — Design a binary diagnostic for each candidate cause

Each diagnostic should have **only two possible outcomes**, and each outcome should point to a specific cause.

```
Run: <list deployed services>
  - If service appears in list → deployed; move to next candidate (auth).
  - If service missing → that is the bug; deploy it; rerun system test.
```

**Why this matters:** A diagnostic that returns "interesting data" is useless. A diagnostic that returns yes/no advances the loop.

**Practical tip:** logs and DB queries are usually better diagnostics than UI screenshots. They tell you what the system *did*, not what the user *saw*.

### Step 4 — Look at logs / DB / system state BEFORE proposing a fix

The single most common mistake: jumping straight to a hypothesised fix without checking what actually happened. Symptoms are ambiguous; logs and DB state are ground truth.

Ground-truth sources to check first:

- Server logs — what the function did (or did not do).
- Routing/proxy logs — whether requests even reached the function (catches auth-layer rejections that produce zero app-level logs).
- Database queries — what state actually got written.
- HTTP traces / network tab — request/response headers, status codes, body shape.

If logs are empty when you expected output, that is a high-signal data point: **the code never ran.** Possible causes shift to "was not invoked" / "rejected before execution" rather than "ran with a bug."

### Step 5 — Test the component in isolation BEFORE testing the system

If a system has Caller → Service → Database, test each layer independently before testing them together.

1. Can you invoke the Service directly (bypassing the Caller)? If no, the Service is the bug.
2. If yes, can the Caller dispatch to the Service correctly? If no, the dispatch is the bug.
3. If yes, does the data flow end-to-end? If no, it is an integration bug between layers.

**Why this matters:** Testing only end-to-end means "something in this chain is broken" — you do not know which link. Isolated tests pinpoint the broken link.

### Step 6 — Distinguish "code does not exist" from "code exists but is not deployed"

These two failure modes produce **identical user-facing symptoms** but have **completely different fixes**:

- "Code does not exist" → write the code, commit, deploy.
- "Code exists but is not deployed" → just deploy.

Before writing any new code, verify the supposedly-missing functionality is not already in source but unshipped:

- Check the latest commit's deploy status on every deploy target (web bundle, edge functions, mobile build, etc.).
- A shared module's change requires redeploying every consumer that imports it, not just the module's own deploy.

The cheapest fix is almost always "redeploy and re-verify" — try that before writing code.

### Step 7 — Propose ONE fix, hand it to Claude Code, ship it in one commit

Once the diagnostic narrows the cause to one candidate, write a complete Claude Code prompt covering:

1. **Root cause statement** (one paragraph): what is broken, how you know, what the data showed.
2. **The fix** (specific file changes, code shape, not just intent).
3. **Test plan** (what you run after Claude Code ships to verify the fix worked end-to-end).
4. **Commit message** (so the diagnosis becomes searchable history).
5. **Audit for sibling bugs** (see Step 9).

**Why specific:** Vague Claude Code prompts ("fix the auth issue") produce vague fixes. Specific prompts ("add a manual apikey check at the top of `<file>` comparing `req.headers.get('apikey')` against `Deno.env.get('<env_var>')`") produce surgical fixes.

### Step 8 — Verify on prod after deploy

"Shipped to main" is not "fixed." Ship + deploy + verify on prod with the same diagnostic that surfaced the bug.

1. Confirm the deploy actually went through (build green, version number incremented).
2. Re-run the diagnostic that surfaced the bug. The output should now show the fixed state.
3. Run a fresh end-to-end test (do not just trust the diagnostic — actually use the feature).

If verification fails, return to Step 3 — the diagnostic was incomplete or the fix was wrong. **Do not double down on the original hypothesis.**

### Step 9 — Audit for sibling bugs

Once you have diagnosed one instance of a bug class, search the codebase for other instances of the same class. Example: if you found one server-to-server function call that was misconfigured, grep for ALL server-to-server calls — most likely some of the others have the same issue.

**Why this matters:** Bug classes are often born from a misunderstanding of an API or framework convention. The same misunderstanding produces multiple instances. Fixing one and leaving the others is shipping a future incident.

### Step 10 — Capture the lesson so it does not repeat

Two outputs from every non-trivial diagnosis:

1. **Architectural rule added to `CLAUDE.md`** (and to Part 9 below). The rule should describe: symptom, cause, fix recipe, and how to detect it next time.
2. **Memory entry** if the diagnosis revealed something about how you work or what tooling you have.

### Bug Diagnosis Quick Checklist (one-pager)

- [ ] Step 1 — what is the symptom (exactly what you see, not what you think is wrong)?
- [ ] Step 2 — list 3–5 plausible causes, cheapest-to-check first.
- [ ] Step 3 — for each cause, what is the binary diagnostic that confirms/rejects it?
- [ ] Step 4 — run the cheapest diagnostic first; look at logs, DB, system state.
- [ ] Step 5 — test components in isolation before testing the system.
- [ ] Step 6 — is the supposedly-missing feature actually missing, or just undeployed?
- [ ] Step 7 — propose ONE specific fix; write a complete Claude Code prompt; ship in one commit.
- [ ] Step 8 — verify on prod with the same diagnostic that surfaced the bug.
- [ ] Step 9 — audit for sibling bugs of the same class.
- [ ] Step 10 — capture the lesson (`CLAUDE.md` rule + memory entry if relevant).

### Worked example — applying the loop to a real symptom

**Symptom:** "After I import a property, the 'Preparing…' indicator stays forever and never completes."

- **Step 2 candidates:** (1) Background task service is not deployed. (2) Service is deployed but auth-rejecting calls. (3) Service runs but errors silently. (4) Dispatch from the import flow is misconfigured. (5) Service runs but writes status to wrong location.
- **Step 3 diagnostics (binary):** `<list functions>` — in list? Logs show requests reaching it? Logs show completion? DB row with completed status?
- **Step 4** — checked logs first. Showed 401 routing-layer rejections with zero app-level logs. Combined with diagnostic #1 (service WAS in list), narrowed to #2 (auth rejection).
- **Step 5** — confirmed by manually invoking the service directly with proper credentials. Ran fine. Bug was in dispatch path.
- **Step 7** — single fix: redeploy with auth-verify disabled + add manual apikey check at function top. One commit.
- **Step 8** — verified on prod: re-imported, watched status flip pending → running → complete in ~7s.
- **Step 9** — grepped for all server-to-server function calls. Found one more with same pattern. Fixed same sprint.
- **Step 10** — added architectural rule (now L13 below) so next person recognises the log signature instantly.

**Total time:** ~90 min including sibling-bug fix. **Time saved over speculative-fix path:** ~3 hours.

---

## Part 8 — Anti-patterns and hard rules

### Anti-patterns to avoid

- **Speculative fixing without data.** "It might be auth, so I will change the auth code." Do not. Check logs first.
- **Fix-and-pray loops.** Shipping multiple speculative fixes hoping one works — each commit blurs which change actually fixed the issue.
- **Trusting UI state as ground truth.** UI can lie (cached state, stale local storage, optimistic updates that did not roll back). DB and logs do not lie.
- **Confusing "no output" with "no errors."** Silent failure is a class of bug, not a sign of success.
- **Skipping the audit for sibling bugs.** Almost guarantees one of the other instances will surface within a week.
- **Skipping the lesson capture.** Lesson gets re-learned next quarter at full cost.
- **Letting Claude Code re-architect things at midnight.** If you find yourself accepting a fifth attempt at the same fix, stop. Paste the situation into Cowork.
- **Using Cowork to write production code.** It can, but won't run your dev server or commit. Slower and riskier than Claude Code.
- **Forgetting to update the docs.** Decisions made in chat that don't make it into a doc evaporate.
- **Re-explaining the project every session.** Both tools read this folder. Trust them. `CLAUDE.md` exists so you never have to re-explain.

### Hard rules — what NOT to do

- Do not add features I did not ask for. The MVP is intentionally narrow.
- Do not rewrite a file from scratch when an `Edit` would do.
- Do not bulk-scrape third-party portals. User-initiated, single-URL, rate-limited fetches only.
- Do not republish content imported from third parties (photos, floor plans, listing text).
- Do not promise valuations. Phrasing is always "estimate", "indicative", "comparable sales suggest".
- Do not store secrets in the client bundle. Ever.
- Do not edit production database tables directly in the dashboard once real users exist.
- Do not market the product as bulk extraction or anything that implies crawling. Marketing copy goes past me before going live.

---

## Part 9 — Lessons learned (carry these into every new project)

*Format: short title, symptom, root cause, fix recipe, detection signature. Append new lessons as you diagnose new bug classes. **Never delete** — even retired lessons stay as historical context.*

### L1 — Helper functions must be defined after the tables they query

- **Symptom:** Migration script aborts at a `CREATE FUNCTION` or `CREATE POLICY` line with a "relation … does not exist" error, even though the table is also being created in the same script.
- **Root cause:** Postgres validates the function body at creation time. `current_org_id()` referenced the `profiles` table, but the function was declared *above* the `CREATE TABLE profiles` statement, so the table did not exist yet when Postgres parsed the function.
- **Fix recipe:** Inside a single migration, order DDL strictly as: (1) all `CREATE TABLE` statements, (2) helper functions that read from those tables, (3) RLS policies that call those functions, (4) triggers. If a function genuinely must come earlier, mark it `LANGUAGE plpgsql` with a body that defers name resolution (or split the migration into two files).
- **Detection signature:** "relation `<name>` does not exist" raised during a `CREATE FUNCTION` or `CREATE POLICY`, *not* during the table create itself.

### L2 — PowerShell `>` redirect produces UTF-16 + mixes in stderr

- **Symptom:** A file generated by piping a CLI command's output through PowerShell's `>` operator looks corrupted — wrong encoding (TypeScript / JSON parsers complain about a BOM or unexpected characters at the top), or contains tool log messages mixed into the intended content.
- **Root cause:** PowerShell's `>` operator writes UTF-16 LE with a BOM by default (not UTF-8), and depending on the stream it can fold stderr into the output too.
- **Fix recipe:** For byte-clean stdout-only redirection on Windows, wrap the command: `cmd /c "supabase gen types typescript --linked > src/types/database.ts"`. If you must stay in PowerShell, pipe through `| Out-File -Encoding utf8 -FilePath path\to\file` instead of using `>`.
- **Detection signature:** The first byte of the generated file is `0xFF 0xFE` (UTF-16 BOM) instead of normal ASCII, or the file contains lines like "Connecting to remote database…" that were meant to be log output.

### L3 — `supabase link` writes state into the current folder — always run it from the project root

- **Symptom:** `supabase` CLI commands behave as if no project is linked, or link state (a `supabase/` folder, `.temp` files, generated types) ends up somewhere unexpected like `C:\Users\benco\`.
- **Root cause:** `supabase link` creates and reads its config relative to the current working directory.
- **Fix recipe:** Always `cd` to the project root before running any `supabase` command. Verify with `pwd`. To clean up a stray link: delete the misplaced `supabase/` folder, `cd` to the real project root, then re-run `supabase link --project-ref <ref>`.
- **Detection signature:** `supabase status` says "no project linked" despite a recent `link` command, OR you find a `supabase/` folder in your user-home directory that you did not put there.

### L4 — Supabase web SQL editor's "Explain" toggle rejects DO blocks

- **Symptom:** A `DO $$ … $$;` block runs cleanly in `psql` or as a migration file, but pasting the exact same SQL into the Supabase dashboard's SQL editor produces a confusing syntax-like error.
- **Root cause:** The "Explain" toggle wraps your query in `EXPLAIN ANALYZE` before sending it. `EXPLAIN` cannot be applied to a DO block.
- **Fix recipe:** In the SQL editor toolbar, click the "Explain" toggle off, then re-run. (Alternative: run DO blocks from `supabase db push`.)
- **Detection signature:** The error message references `EXPLAIN`, or the same SQL works locally but fails only in the web SQL editor.

### L5 — *Retired (2026-05-16)*

This lesson originally captured the friction of a two-folder setup (Cowork in a separate docs folder, Claude Code in the code folder). On 2026-05-16 the docs were merged into the project's `docs/` folder so both tools share one project root. The friction is gone; the lesson is retired. **If you find yourself referencing AGENTS.md or a separate docs folder, you are reading an old prompt — `CLAUDE.md` at the project root is now the single source of truth.**

### L6 — plpgsql `array || element` is ambiguous on empty arrays 