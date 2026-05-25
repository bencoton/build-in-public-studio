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

### BIPS-L2 — Native-binding npm packages lag behind new Node versions

- **Symptom:** `npm install` fails on a package like `better-sqlite3` with `prebuild-install warn install No prebuilt binaries found (target=<your-node-version>...)` followed by a `node-gyp` fallback that errors with "Could not find any Visual Studio installation to use".
- **Root cause:** Packages with native C++ bindings (better-sqlite3, sqlite3, sharp, canvas, anything else that calls out to native code) ship prebuilt binaries for the popular Node versions only. When you're on a Node release newer than the package has built for, npm falls back to compiling from source, which on Windows needs Visual Studio Build Tools (a ~5GB install).
- **Fix recipe:** **First** — check whether a Node built-in covers the use case. `node:sqlite` covers anything `better-sqlite3` does for a basic local app. Built-ins always work; no install lag. Drop the npm dep and use the `node:*` import. **Second** — if no built-in fits, downgrade Node to the most recent LTS the package supports (commonly via `nvm-windows` / `fnm`). **Last resort** — install Visual Studio Build Tools and let `node-gyp` rebuild.
- **Cross-project rule:** Before reaching for a native-binding npm package, check whether the equivalent Node built-in (`node:sqlite`, `node:crypto`, `node:fs/promises`, `node:test`, etc.) is sufficient. The WyCo Tech-Stack doc's "Prefer fewer dependencies" principle applies harder to native ones — they have an extra failure mode (the prebuild lottery) regular pure-JS packages don't.
- **Detection signature:** Log contains `prebuild-install warn install No prebuilt binaries found (target=...)` AND `find VS could not use PowerShell to find Visual Studio 2017 or newer`.

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
