# CLAUDE.md — Project Rules for build-in-public-studio

## User

Ben. Beginner-leaning developer. Backend / scripting experience; mobile is newer. Always give complete how-to guides, do not skip steps. If a command needs to run in a specific directory, say which directory.

## How this project works

- Workflow rules: see [`docs/Ways-of-Working.md`](./docs/Ways-of-Working.md).
- Tech stack reference: see [`docs/Tech-Stack.md`](./docs/Tech-Stack.md).
- Visual / brand: see [`docs/WYCO-DIGITAL-STYLE-GUIDE.md`](./docs/WYCO-DIGITAL-STYLE-GUIDE.md).
- Project metadata + rolling shipped log: see [`PROJECT.md`](./PROJECT.md) at the root.
- Phased plan for this project: see [`docs/PLAN.md`](./docs/PLAN.md).
- Session log: append to [`NOTES.md`](./NOTES.md) at the end of every session.
- Open bugs / polish: track in [`KNOWN-ISSUES.md`](./KNOWN-ISSUES.md).

## Project basics

- **Stack:** Web — Next.js 14 (App Router) + TypeScript + Tailwind. **Deliberate deviation from the standard WyCo stack:** no Supabase, no Vercel for the local app. Storage is `better-sqlite3` (a single `.sqlite` file in the project root). All API calls run locally from the user's machine using their own keys. The hosted SaaS version (if it happens) would adopt the standard WyCo stack — see `docs/PLAN.md` Phase 2.
- **Default UI theme:** dark, with a light toggle (the toggle ships in Stage 10 — until then, dark only).
- **Accent colour:** Teal — the parent WyCo brand primary (`#14b8a6`). Build-in-Public Studio is positioned as a meta-tool in the WyCo family, not a separate product, so it borrows the parent brand colour rather than claiming a new slot in the product-family table.
- **Audience:** solo devs and indie hackers shipping in public. Public from day one.
- **Visibility:** `public: true` in `PROJECT.md`. The GitHub repo starts private and flips to public when the OSS launch ships (planned for Stage 10).

## Hard rules (load-bearing — full list in docs/Ways-of-Working.md)

1. **Handoff protocol — recommend, don't fight.** When the current request is better served by the OTHER tool, stop, name the handoff, draft the prompt for the other tool, and wait for the user's green light. See `docs/Ways-of-Working.md` Part 2. In practice for this project: Cowork writes docs, prompts, plans, and source code via its file tools; Ben runs every `npm`, `git`, and `gh` command in PowerShell himself.
2. **Auto-push policy:** after every clean commit (tsc + lint pass), Ben pushes to `origin/main` without further confirmation.
3. **Always run `git status` and `git log --oneline -5` at the start of every session** before making changes.
4. **Bug Diagnosis Loop:** when a bug is reported, do NOT propose a fix until the data has narrowed the cause. See `docs/Ways-of-Working.md` Part 7. Never enter a fix-and-pray loop.
5. **Update PROJECT.md's "Shipped recently" section in the same commit as any user-visible change.**
6. **When the current phase ships, update `docs/PLAN.md` AND `PROJECT.md`'s "Current phase" in the same commit.**
7. **100% of code in this project is Claude-generated.** This is not a footnote — it is the credibility hook of the product itself. State this in user-facing copy where natural; never claim Ben hand-wrote code he didn't.
8. **Ask before adding any new dependency.** Including small ones. The current dep list is in `package.json`; if a new feature wants to add to it, that is an "ask first" event per Ways-of-Working Part 5.

## Project-specific rules

1. **Never auto-publish to social platforms.** Even when the API for X or LinkedIn would allow it. The Copy + Open flow is a deliberate product choice — humans stay in the loop on every post. Auto-publish is a Phase 3+ feature, if ever, and only after explicit user opt-in per post.
2. **The "I'm a beginner learning" angle in drafted posts is on-brand, not a weakness.** Drafts that lean into that are good; drafts that paper over it (overconfident, claiming expertise) are off-brand.
3. **Banned words for drafted posts (bake into the Claude prompt):** revolutionize, leverage, unlock, delve, "in today's fast-paced world", "I'm excited to share". Plus any words the user adds in Settings.
4. **Mark anything uncertain in drafted posts with `[VERIFY]`.** Hallucinated specifics are worse than admitting a gap.
5. **API keys never in code, never in commits.** All secrets live in `.env.local` only. The `.gitignore` covers `.env*.local`.
6. **One clear takeaway per post.** Specific over generic ("3 hours debugging one missing await" > "fixed a bug").

## Lessons learned (project-specific)

*Append below as you diagnose new bugs. Cross-project lessons live in `docs/Ways-of-Working.md` Part 9 — read those first before duplicating.*

### BIPS-L1 — `npm install` doesn't survive the Cowork sandbox

- **Symptom:** Running `npm install` from inside the Cowork bash sandbox times out or leaves a corrupted `node_modules` (temp `.acorn-XYZ` directories that never get renamed to their final paths).
- **Root cause:** The sandbox caps a single bash call at ~45 seconds. `npm install` for a Next.js project takes 1–3 minutes. Background processes get killed when the bash session resets.
- **Fix recipe:** Cowork never runs `npm install`. It writes file content via Write/Edit, and hands every shell command to Ben for PowerShell. This is the handoff protocol working as intended.
- **Detection signature:** `find node_modules -name '.acorn-*' -o -name '.ajv-*'` returns results, OR the top-level package dirs are stubs with no `dist/` or `lib/` contents.
