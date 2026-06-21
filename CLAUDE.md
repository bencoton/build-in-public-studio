# CLAUDE.md — Project Rules for build-in-public-studio

## User

Ben. Beginner-leaning developer. Backend / scripting experience; mobile is newer. Always give complete how-to guides, do not skip steps. If a command needs to run in a specific directory, say which directory.

## How this project works

- Project metadata + rolling shipped log: see [`PROJECT.md`](./PROJECT.md) at the root.
- Phased plan for this project: see [`docs/PLAN.md`](./docs/PLAN.md).
- Session log: append to [`NOTES.md`](./NOTES.md) at the end of every session.
- Open bugs / polish: track in [`KNOWN-ISSUES.md`](./KNOWN-ISSUES.md).

## Project basics

- **Stack:** Web — Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind. Postgres via Neon (`postgres.js` client, pooled connection, `prepare: false` for the transaction-mode pooler). Deployed to Vercel with Anthropic + GitHub API keys as env vars. Weekly generation is triggered by **Vercel Cron** (Stage 9b.4) — schedule in `vercel.json`, gated route at `/api/cron/generate` that requires a `CRON_SECRET` Bearer header. Migrated from `better-sqlite3` → Supabase → Neon over Stages 9b.1–9b.3, then from Next.js 14 → 16 alongside the `@anthropic-ai/sdk` 0.30 → 0.99 bump in Stage 10.3. See Migration-Runbook.md Part 2.1 in the WoW folder for stack-pivot context.
- **Default UI theme:** dark, with a light toggle (the toggle ships in Stage 10 — until then, dark only).
- **Accent colour:** Teal — the parent WyCo brand primary (`#14b8a6`). Build-in-Public Studio is positioned as a meta-tool in the WyCo family, not a separate product, so it borrows the parent brand colour rather than claiming a new slot in the product-family table.
- **Audience:** solo devs and indie hackers shipping in public. Public from day one.
- **Visibility:** `public: true` in `PROJECT.md`. The GitHub repo starts private and flips to public when the OSS launch ships (planned for Stage 10).

## Hard rules (load-bearing)

1. **Handoff protocol — recommend, don't fight.** When the current request is better served by the OTHER tool, stop, name the handoff, draft the prompt for the other tool, and wait for the user's green light. In practice for this project: Cowork writes docs, prompts, plans, and source code via its file tools; Ben runs every `npm`, `git`, and `gh` command in PowerShell himself.
2. **Auto-push policy:** after every clean commit (tsc + lint pass), Ben pushes to `origin/main` without further confirmation.
3. **Always run `git status` and `git log --oneline -5` at the start of every session** before making changes.
4. **Bug Diagnosis Loop:** when a bug is reported, do NOT propose a fix until the data has narrowed the cause. Never enter a fix-and-pray loop.
5. **Update PROJECT.md's "Shipped recently" section in the same commit as any user-visible change.**
6. **When the current phase ships, update `docs/PLAN.md` AND `PROJECT.md`'s "Current phase" in the same commit.**
7. **100% of code in this project is Claude-generated.** This is not a footnote — it is the credibility hook of the product itself. State this in user-facing copy where natural; never claim Ben hand-wrote code he didn't.
8. **Ask before adding any new dependency.** Including small ones. The current dep list is in `package.json`; if a new feature wants to add to it, that is an "ask first" event.

## Project-specific rules

1. **Never auto-publish to social platforms.** Even when the API for X or LinkedIn would allow it. The Copy + Open flow is a deliberate product choice — humans stay in the loop on every post. Auto-publish is a Phase 3+ feature, if ever, and only after explicit user opt-in per post.
2. **The "I'm a beginner learning" angle in drafted posts is on-brand, not a weakness.** Drafts that lean into that are good; drafts that paper over it (overconfident, claiming expertise) are off-brand.
3. **Banned words for drafted posts (bake into the Claude prompt):** revolutionize, leverage, unlock, delve, "in today's fast-paced world", "I'm excited to share". Plus any words the user adds in Settings.
4. **Mark anything uncertain in drafted posts with `[VERIFY]`.** Hallucinated specifics are worse than admitting a gap.
5. **API keys never in code, never in commits.** All secrets live in `.env.local` only. The `.gitignore` covers `.env*.local`. **Includes `CRON_SECRET`** — the Bearer token Vercel Cron sends to `/api/cron/generate`. Must be set identically in `.env.local` (for parity) and in Vercel's Environment Variables (Production + Preview + Development, marked Sensitive). If it's missing in Vercel, the cron endpoint returns 500 "Server misconfiguration" by design — fail closed.
6. **One clear takeaway per post.** Specific over generic ("3 hours debugging one missing await" > "fixed a bug").
7. **Vercel Cron schedules are UTC-only.** The schedule in `vercel.json` (`0 8 * * 1,4`) is Mon + Thu 08:00 UTC, which is 9am UK during BST and 8am UK during GMT. The DB-stored `schedule_cron` setting (used by `AppHeader` to render "Next run: in X") is timezone-aware via cron-parser, so the countdown shown in the UI stays accurate year-round even though the trigger time drifts by an hour at DST changeover.

## Lessons learned (project-specific)

*Append below as you diagnose new bugs.*

### BIPS-L1 — `npm install` doesn't survive the Cowork sandbox

- **Symptom:** Running `npm install` from inside the Cowork bash sandbox times out or leaves a corrupted `node_modules` (temp `.acorn-XYZ` directories that never get renamed to their final paths).
- **Root cause:** The sandbox caps a single bash call at ~45 seconds. `npm install` for a Next.js project takes 1–3 minutes. Background processes get killed when the bash session resets.
- **Fix recipe:** Cowork never runs `npm install`. It writes file content via Write/Edit, and hands every shell command to Ben for PowerShell. This is the handoff protocol working as intended.
- **Detection signature:** `find node_modules -name '.acorn-*' -o -name '.ajv-*'` returns results, OR the top-level package dirs are stubs with no `dist/` or `lib/` contents.

### BIPS-L2 — Native-binding npm packages lag behind new Node versions

- **Symptom:** `npm install` fails on a package like `better-sqlite3` with `prebuild-install warn install No prebuilt binaries found (target=<your-node-version>...)` followed by a `node-gyp` fallback that errors with "Could not find any Visual Studio installation to use".
- **Root cause:** Packages with native C++ bindings (better-sqlite3, sqlite3, sharp, canvas, anything else that calls out to native code) ship prebuilt binaries for the popular Node versions only. When you're on a Node release newer than the package has built for, npm falls back to compiling from source, which on Windows needs Visual Studio Build Tools (a ~5GB install).
- **Fix recipe:** **First** — check whether a Node built-in covers the use case. `node:sqlite` covers anything `better-sqlite3` does for a basic local app. Built-ins always work; no install lag. Drop the npm dep and use the `node:*` import. **Second** — if no built-in fits, downgrade Node to the most recent LTS the package supports (commonly via `nvm-windows` / `fnm`). **Last resort** — install Visual Studio Build Tools and let `node-gyp` rebuild.
- **Cross-project rule:** Before reaching for a native-binding npm package, check whether the equivalent Node built-in (`node:sqlite`, `node:crypto`, `node:fs/promises`, `node:test`, etc.) is sufficient. The WyCo Tech-Stack doc's "Prefer fewer dependencies" principle applies harder to native ones — they have an extra failure mode (the prebuild lottery) regular pure-JS packages don't.
- **Detection signature:** Log contains `prebuild-install warn install No prebuilt binaries found (target=...)` AND `find VS could not use PowerShell to find Visual Studio 2017 or newer`.

### BIPS-L5 — Legacy-Node npm packages can't be cleanly bundled by Next.js's webpack

- **Symptom:** A server-side dependency added to a Next.js project causes compile errors like `Module not found: Can't resolve 'net'` (or `'fs'`, or `'child_process'`) with import traces pointing deep inside `node_modules/<pkg>/...`. The dev server returns 500 on every route. `experimental.serverComponentsExternalPackages` doesn't help — even with the offending package marked as external, webpack still tries to bundle its transitive deps and chokes on the same class of missing built-in.
- **Root cause:** The added package was built for plain Node.js scripts (sometimes literally years before webpack-bundled Node servers were common). Its tree contains modules that do `require('net')` / `require('fs')` at top level, assuming a Node-only runtime. Webpack tries to statically analyse these imports during the bundle step and fails because in its context those built-ins aren't on the resolution path.
- **Detection signature:** `Module not found: Can't resolve '<built-in>'` where `<built-in>` is one of `fs`, `net`, `child_process`, `path`, `os`, `crypto`, etc., AND the import trace runs through `node_modules/<some-package>/...`. Marking the top-level package as `serverComponentsExternalPackages` helps with that one package but the next transitive dep in the chain throws the same error.
- **Fix recipe (in order of preference):**
  1. **Drop the package.** Often the feature it provides is over-engineered for a local app — replace with a Node built-in (`node:child_process` for shelling out, native `Notification` API on the browser side, `console.log` for dev signalling) or remove the feature entirely.
  2. **Find a webpack-friendly alternative.** Look for packages with "isomorphic" or "next.js compatible" in their description — they were built with bundling in mind. For scheduling: `cron-parser` (pure JS, parses cron expressions) + `setTimeout` is enough for most cases without needing `node-cron`.
  3. **Hide the import from webpack's static analysis** via `new Function('return require')()('package-name')` or similar runtime-only require pattern. Works but adds technical debt; the next Next.js version may break it.
- **`experimental.serverComponentsExternalPackages` does not reliably help for instrumentation.** We tried this for `node-notifier` and again for `node-cron` on Next.js 14.2.35. Webpack still bundled the dependency chain and choked on the missing built-ins. The flag may help for normal server components and route handlers, but it does **not** apply to the instrumentation file's bundle pass. If your problematic import path runs through `src/instrumentation.ts`, fall through to fix-recipe step 1 (drop the package).
- **Cross-project rule:** Before adding any server-only npm package to a Next.js project, glance at the package's dependencies. A wide tree with names like `is-wsl`, `is-docker`, `growly`, `tmp`, `cross-spawn`, `which`, `node-gyp` is a red flag. Even narrower packages like `node-cron` can break — it has worker-script imports that webpack can't resolve. Pure-JS packages with shallow trees that don't use workers, child processes, or filesystem (`cron-parser`, `@anthropic-ai/sdk`, `octokit`) bundle fine.

### BIPS-L4 — `node:sqlite` returns null-prototype rows; spread them before crossing Server → Client component boundaries

- **Symptom:** `Error: Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported.` Fired when a Server Component renders a Client Component and passes DB-derived data as a prop.
- **Root cause:** `node:sqlite`'s `Statement.all()` and `.get()` return rows constructed via `Object.create(null)` — they have **no prototype**. Next.js's RSC serializer rejects null-prototype objects at the Server → Client boundary even though they JSON-stringify fine.
- **Fix recipe:** Spread DB rows into a fresh object literal before passing them as a prop. `{...row}` produces an object with `Object.prototype`, which serializes cleanly. Spread every level — if you have a row containing an array of rows, spread the outer object AND map-spread every element of the inner array. Tip: do this in your data-access helper (e.g. `getLatestGeneration()`), not in the page component, so every consumer benefits.
- **When you don't need this:** when DB data is rendered directly in the Server Component's JSX (no Client Component prop crossing). Notes list, commits list, etc. work fine as-is — they're only re-shaped for the dashboard where `MomentCard` is a client component.
- **Cross-project rule:** Anywhere a Next.js Server Component reads from `node:sqlite` and hands the result to a Client Component (`"use client"` file imported and rendered from a server component), shape the data in the data-access layer with object spreads. Don't pass raw rows.
- **Detection signature:** Runtime error message contains "Only plain objects ... can be passed to Client Components" with a stack trace through `app-page.runtime.dev.js`. The offending prop is typically a DB-shaped object or an array of them.

### BIPS-L3 — `node:sqlite` has no `.transaction()` helper; use BEGIN/COMMIT/ROLLBACK manually

- **Symptom:** Runtime error `db.transaction is not a function` when calling `db.transaction(() => { ... })`. The code looks correct because the same pattern works in `better-sqlite3`.
- **Root cause:** `node:sqlite`'s `DatabaseSync` class has a smaller API surface than `better-sqlite3`. There is no `.transaction()` helper method. The mistake is muscle-memoried from better-sqlite3 — easy to make if you've used that library a lot.
- **Fix recipe:** Wrap with explicit transaction statements. A small helper in `src/lib/db.ts` keeps callers clean:

  \`\`\`ts
  export function transaction<T>(fn: () => T): T {
    db.exec("BEGIN");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch {}
      throw err;
    }
  }
  \`\`\`

  Callers use \`transaction(() => { ... })\` exactly like the better-sqlite3 idiom.
- **Cross-project rule:** Other better-sqlite3-only APIs that don't exist on `node:sqlite`: \`.pragma()\` (use \`db.exec("PRAGMA ...")\`), typed generics on \`.prepare<P, R>()\` (cast the result with \`as R\` instead), \`.iterate()\` (no streaming iterator; use \`.all()\` or call \`.get()\` in a loop), \`.backup()\` (no built-in backup helper). Before reaching for a better-sqlite3 idiom in this project, check the [`node:sqlite` docs](https://nodejs.org/api/sqlite.html) first.
- **Detection signature:** Runtime error referencing a method on `db` that exists in better-sqlite3 but not in `node:sqlite`. Common variants: \`.transaction\`, \`.pragma\`, \`.iterate\`, \`.backup\`.

### BIPS-L6 — Next 16 removed `next lint`; ESLint 9 ignores `.eslintrc.json` — the lint gate silently dies

- **Symptom:** `npm run lint` (script was `"next lint"`) either errors that the command is gone or reports a false "clean". The required pre-commit lint gate is effectively off until a direct `eslint .` later surfaces a backlog of problems at once. First hit during the Phase 1.5c Reddit session (2026-06-20).
- **Root cause:** Two breaking changes arrived together. (1) **Next.js 16 removed the `next lint` command** that the original `package.json` script depended on. (2) **ESLint 9 dropped the legacy `.eslintrc.json`** format for flat config (`eslint.config.mjs`) — a leftover `.eslintrc.json` is silently ignored.
- **Fix recipe (proven here):**
  1. `package.json`: `"lint": "next lint"` becomes `"lint": "eslint ."`.
  2. Add `eslint.config.mjs` flat config reusing the **already-installed** `eslint-config-next` v16 presets (`next/core-web-vitals` + `next/typescript`) via FlatCompat — **no new dependency**.
  3. **Delete the dead `.eslintrc.json`** (ignored under flat config; remove it so it doesn't mislead).
  4. Triage what surfaces. `eslint-plugin-react-hooks` v7 rules (`set-state-in-effect`, purity) flag patterns ESLint 8 didn't — `Date.now()` in render, set-state in effects, the `next-themes` mount-guard timer. Fix the clear ones; downgrade only the *new* rules to `warn` to unblock the gate and log them in `KNOWN-ISSUES.md` for a dedicated pass (don't leave the whole gate red).
- **Detection signature:** `npm run lint` says `next lint` is unknown, OR exits 0 with `.eslintrc.json` present and no `eslint.config.*`, OR `npx eslint .` finds problems `npm run lint` missed.
- **Cross-project version:** promoted to `docs/Ways-of-Working.md` Part 9 as **L15** — every project taking the Next 14→16 bump must migrate ESLint to flat config in the same session and re-verify the lint gate actually runs.

### BIPS-L7 — postgres.js returns jsonb as a STRING here; coerce jsonb arrays at the read boundary (the TS type is not enforced)

- **Symptom:** A jsonb-array column blows up a consumer that assumes an array — `(x.prePostChecklist ?? []).join is not a function`, or `.map`/`.length` misbehaving. First hit as a build-blocking `vercel build` prerender crash on `/settings` (2026-06-21): `subreddits.prepost_checklist`, declared `string[] | null`, arrived as the literal string `'["…","…"]'`.
- **Root cause:** With this app's Neon pooled connection (`postgres.js`, `prepare: false`), jsonb columns deserialize to a **JSON string**, not a parsed JS array — confirmed by ground-truth probe: `SELECT pg_typeof(col), col` → `pg_type: jsonb`, but `typeof value === "string"`, `Array.isArray(value) === false`. The TypeScript type (`string[] | null`) is a **compile-time fiction** at the DB boundary; nothing enforces it at runtime.
- **This bites every jsonb array column, not just the one that crashed.** `moments.source_ref` (also jsonb) returns a string too. Its `Array.isArray(source_ref)` guard does NOT parse — it silently falls through to `[]`, so `source_refs` is empty on every DB *read* (the in-memory generation path is unaffected; the damage is to re-reads: moment-card badges, regenerate context, on-demand Reddit source material). **An `Array.isArray`-only guard hides the bug instead of fixing it.**
- **Fix recipe:** Coerce at the **read choke point** (the data-access mapper), so every consumer downstream gets a real array — don't guard at each render site. Pattern: `if typeof === "string" → JSON.parse (catch → null); then if !Array.isArray → null; else filter to the element type`. Apply it wherever the row is shaped (every SELECT/RETURNING mapper). Keep a defensive `Array.isArray(x) ? x : []` at any `.join`/`.map` render site as belt-and-braces, but the real fix is the boundary.
- **Two adjacent gotchas surfaced the same day:** (a) DB-reading pages must be `export const dynamic = "force-dynamic"` — otherwise Next statically *prerenders* them at build time, which both reads the prod DB during the build and turns a bad-data read into a hard build failure. (b) See BIPS-L4 — jsonb rows already need spreading for the Server→Client boundary; coercion folds into the same mapper.
- **Detection signature:** `.join`/`.map`/`.length` failing on a value sourced from a jsonb column; a jsonb-derived array that's mysteriously always empty after a round-trip; `typeof row.jsonbCol === "string"` in a debug log. Before trusting a jsonb column's TS type, probe `pg_typeof` + `typeof`/`Array.isArray` once.
