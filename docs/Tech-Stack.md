# Tech Stack

*What to use on every new project — and what to add only when you need it*

**Last updated:** 24 May 2026
**Status:** Living document — update as your stack evolves. Reference projects: `reconfig-app` (mobile), `stashery` (web).
**Companion docs:** [`Ways-of-Working.md`](./Ways-of-Working.md) (workflow + lessons), [`WYCO-DIGITAL-STYLE-GUIDE.md`](./WYCO-DIGITAL-STYLE-GUIDE.md) (visual / brand).

---

## How to use this document

This is the canonical record of the stack I have built and refined across previous projects. Use it as a starting point for any new project:

1. **Decide the shape first** — is this project web (Next.js path) or mobile (Expo path)? Both share the same backend, AI, and ops layers.
2. **Stand up the Core stack on day one** (Part 1) — hosting, framework, database, auth, email, source control, the AI dev loop.
3. **Add Optional add-ons only when triggered** (Part 2) — payments, mobile, analytics, scraping, etc.
4. **Inherit the hard-won lessons** (Part 9 below + Part 9 of `Ways-of-Working.md`) — patterns I have already paid for once.
5. **Copy the env-var checklist** (Part 6) into the project's `.env.local` and Vercel/Supabase dashboards before the first build that uses them.

When the stack changes — new provider, retired library, version bump that matters — update this file in the same commit as the change.

---

## Part 1 — Core stack (use on every new project)

These pieces form the default skeleton. Stand them up on day one; they cover hosting, the app framework, the database, auth, email, source control, and the AI dev loop.

### Web vs Mobile path — pick one

The frontend framework is the only fork. Everything below (Supabase, Anthropic, Vercel, GitHub, Resend, the AI dev loop) is shared.

#### Web path — Next.js 14 (App Router) + TypeScript

**Purpose.** The web app framework. Server components, file-based routing, API routes, edge-friendly.

**Why this one.** Tight Vercel integration, big ecosystem, strong TypeScript story. Claude Code knows it well so prompts produce working code first time.

**Setup checklist:**

- [ ] In the project root: `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir`.
- [ ] Accept the defaults; `src/` layout matches the convention used across projects.
- [ ] Commit the scaffold before adding any features so you can always `git diff` against a clean baseline.
- [ ] Styling: Tailwind is included with `--tailwind`. Add **shadcn/ui** later if you need polished components (`npx shadcn@latest init`).

#### Mobile path — Expo SDK 53+ + React Native + TypeScript

**Purpose.** Cross-platform mobile framework on top of React Native, with OTA updates and managed builds.

**Why this one.** Works from Windows (no local Mac needed). EAS cloud builds, Expo Router for file-based routing, native ecosystem.

**Setup checklist:**

- [ ] `npx create-expo-app@latest <project-name>` in `C:\Users\benco\code\`.
- [ ] Routing: Expo Router (file-based routing under `/app`).
- [ ] Styling: **NativeWind** (Tailwind for RN). Avoid inline styles.
- [ ] TypeScript strict mode (default in template). No `any` without a comment justifying it.
- [ ] Use Expo Application Services (EAS) for builds and OTA updates.
- [ ] Do mobile last if you have both web + mobile — validate the product on web first.

#### Shared (both paths)

- TypeScript strict mode. No `any` unless commented with a reason.
- Functional components and hooks only. No class components.
- File naming: `kebab-case.tsx` for components, `camelCase.ts` for utilities, `PascalCase` for types.
- Exports: prefer named exports. One main exported component per file.
- Dates: `date-fns` with UK locale. Currency: GBP with thousands separators.
- **Default theme — ask on day one.** Light or dark? Claude should ask before the first UI commit, record the answer in `CLAUDE.md`, and configure Tailwind / NativeWind accordingly (set `darkMode: 'class'` if you want a runtime toggle; pick the default `<html>` / `<View>` class). Pull colour tokens from [`WYCO-DIGITAL-STYLE-GUIDE.md`](./WYCO-DIGITAL-STYLE-GUIDE.md) — it defines both palettes. Retrofitting a theme later means revisiting every component.

### Supabase (Postgres + Auth + Storage + RLS)

**Purpose.** Database, auth, file storage, and Row-Level Security — all in one managed Postgres.

**Why this one.** One vendor for the four things most apps need. Local CLI mirrors prod, migrations are tracked. RLS removes a whole class of "wrong-user data leaked" bugs.

**Decisions baked in:**

- **Region: London.** UK data residency by default.
- **Auth:** Magic link + email (Supabase Auth).
- **Storage:** Supabase Storage. Auto-cleanup of user-uploaded media after 12 months.
- **Row Level Security:** enabled on every table. No exceptions.
- **Migrations only.** All schema changes are SQL migration files in `/supabase/migrations/`. Never edit tables in the dashboard once you have real users.
- **Query layer:** every write goes through a typed query helper or a server function. No raw `insert/update` calls scattered across screens.

**Setup checklist:**

- [ ] Create a new Supabase project in the dashboard. Save the project ref and the service-role + anon keys.
- [ ] Install the CLI: `npm install -g supabase`.
- [ ] `cd` to the project root (NOT `C:\Users\benco\` — see `Ways-of-Working.md` Lesson L3).
- [ ] Run `supabase init` then `supabase link --project-ref <ref>`.
- [ ] Add `SUPABASE_URL` / `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` variants) to `.env.local` AND to Vercel.
- [ ] Write the first migration in `supabase/migrations/` and apply with `npx supabase db push`.
- [ ] Generate types: `cmd /c "supabase gen types typescript --linked > src/types/database.ts"` (see Lesson L2 — PowerShell `>` mangles encoding).
- [ ] **IMPORTANT:** enable RLS on every table AND write an `INSERT`/`UPDATE`/`DELETE` policy if the app will ever do those operations (see Lesson L11).

### Vercel (hosting + auto-deploy)

**Purpose.** Hosts the web app, runs serverless functions, auto-deploys on git push.

**Why this one.** Zero-config for Next.js; preview deploys per branch; rollbacks are one click. Also used for non-Next.js projects (Expo Web bundles + standalone `/api` functions).

**Setup checklist:**

- [ ] Push the empty scaffold to GitHub first.
- [ ] On vercel.com, "Import Project" and point at the GitHub repo.
- [ ] Set the production branch to `main`. Vercel auto-detects Next.js — no other config needed.
- [ ] Add environment variables on Vercel BEFORE connecting Supabase or any API — they must exist before the first build that uses them.

**Vercel quirks in non-Next.js projects (Expo Web + bare `/api`):**

- **Filename:** `api/<name>.ts` or `api/<name>/index.ts` — NOT `route.ts`. `route.ts` is a Next.js App Router convention; in plain Vercel it falls through to the SPA catch-all.
- **No TypeScript path aliases inside `/api`.** Vercel's serverless bundler does not resolve `@/` aliases. Use relative imports throughout the `api/` subtree.
- **Node runtime uses `http` types, NOT Web Fetch.** Functions pinned to Node receive `VercelRequest` / `VercelResponse`. Use `req.headers.authorization`, `req.body`, `res.setHeader`/`status`/`write`/`end`. Web Fetch patterns (`req.headers.get`, `req.json`, `new Response`, `ReadableStream`) crash on Node.
- **Test discovery** with `curl -i https://<deploy>/api/<name>` — success is **405 with JSON body**. Failure is HTML or a non-JSON 405.

### GitHub (source control + Vercel integration)

**Purpose.** Git host. Vercel deploys from it; Claude Code pushes to it after every clean commit.

**Why this one.** Private repos free, integrates with Vercel out of the box, supports branch protection if you want it later.

**Setup checklist:**

- [ ] Create a private repo named after the project.
- [ ] In Claude Code: `git init`, `git remote add origin <repo-url>`, first commit, `git push -u origin main`.
- [ ] No further branch protection needed at the solo-dev stage. Add when collaborators arrive.
- [ ] Commit style: conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`). See `Ways-of-Working.md` Part 6.

### Anthropic (Claude — vision + text)

**Purpose.** The AI brain. Vision (image → description / fields) and text (summarise / classify / generate).

**Why this one.** Best vision quality at the price; EU data residency; structured output via `tool_use`. Always server-side.

**Decisions baked in:**

- **Region:** EU data residency enabled on the workspace.
- **Default model:** `claude-sonnet-4-6`.
- **Premium model:** `claude-opus-4-6` (higher-tier products / paid plans).
- **Cheap model:** `claude-haiku-4-5` (batch classification, photo tagging, light pre-screening).
- **SDK:** `@anthropic-ai/sdk` — **server-side only** (never in the mobile or client bundle).
- **Output format:** structured JSON via `tool_use`, with a typed schema. Never parse free-form text.
- **Prompt location:** all prompts in `/prompts/` as `.ts` files exporting strings. Never inline a long prompt into business logic.
- **Token telemetry:** every Anthropic call writes a row to a `usage` table — user id, model, input tokens, output tokens, cache hits, estimated GBP cost.
- **Prompt caching:** stable system prompts and tool schemas use `cache_control: { type: 'ephemeral' }`. +25% on cache write, -90% on cache read; pays back after ~2 calls/user/hour.
- **Retries:** set SDK `maxRetries: 0`. Handle retries at the application layer where they are visible and budgetable.

**Setup checklist:**

- [ ] Get an API key from console.anthropic.com.
- [ ] Add `ANTHROPIC_API_KEY` to `.env.local`, Vercel, AND Supabase Edge Functions env (wherever you call from).
- [ ] `npm install @anthropic-ai/sdk`.
- [ ] Build the `usage` table + RLS policy (see Lesson L11) on day one. Without it you cannot price tiers later.
- [ ] Cache responses for any input that does not change across requests.

### Resend (transactional email)

**Purpose.** Sends transactional emails (verification, password reset, receipts, notifications).

**Why this one.** Cleanest developer API of the email providers, free tier is enough for most early-stage projects, plays well with React Email for templates.

**Setup checklist:**

- [ ] Sign up at resend.com, create an API key.
- [ ] Add `RESEND_API_KEY` to `.env.local` AND Vercel.
- [ ] **Verify a custom sending domain by ~Week 7 of any new product.** Magic-link emails go to spam without one. Needs a couple of DNS records.
- [ ] `npm install resend`; send first test email from a server route to confirm the integration.

### Cowork (planning + docs + chat)

**Purpose.** Plans strategy, drafts prompts, writes docs into `docs/`, talks through trade-offs. See `Ways-of-Working.md` Part 2 for full role split.

**Setup checklist:**

- [ ] Open Cowork, click "Open folder", point it at `C:\Users\benco\code\<project-name>`.
- [ ] Confirm Cowork sees `docs/` and `CLAUDE.md`.
- [ ] Done — same folder Claude Code uses, no separate config.

### Claude Code (CLI — writes code, commits, pushes)

**Purpose.** Executes the prompts Cowork drafts. Writes source, runs commands, commits, auto-pushes.

**Setup checklist:**

- [ ] Install Claude Code (claude.com/code) and authenticate.
- [ ] Open a terminal in the project root, run `claude` (the CLI entry point).
- [ ] Run `/init` the first time — it indexes the codebase and writes a starter `CLAUDE.md` (you will replace its workflow section with the rules from `Ways-of-Working.md`).
- [ ] Confirm `git status` output appears at the start of every session (see `Ways-of-Working.md` Part 4).

### ESLint + TypeScript strict mode

**Purpose.** Catches structural bugs before they leave your laptop. Pairs with the auto-push policy — a clean tsc + lint is the gate.

**Why this one.** TypeScript catches null/undefined and shape mismatches; ESLint catches React/Next.js footguns. Together they prevent ~80% of speculative-fix loops.

**Setup checklist:**

- [ ] The Next.js or Expo scaffold installs both. Confirm `tsconfig.json` has `"strict": true`.
- [ ] Add an npm script: `"typecheck": "tsc --noEmit"` — Claude Code runs this before every commit.
- [ ] Add a pre-push checklist in `CLAUDE.md`: `tsc` passes, lint passes, then push.

---

## Part 2 — Optional add-ons (use when you need them)

Add these only when the project actually calls for the capability. Each one has a specific trigger — do not add it speculatively.

### Stripe (payments + subscriptions)

**When to add it.** You need to take money — one-off payments or recurring subscriptions.

**Phasing:**

- **Phase 2:** Stripe Checkout (one-off purchases) — hosted page, no PCI.
- **Phase 3:** RevenueCat + Stripe (subscriptions on mobile + web).

**Setup checklist:**

- [ ] Create a Stripe account, get test + live keys.
- [ ] Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` to `.env.local` AND Vercel.
- [ ] `npm install stripe @stripe/stripe-js`.
- [ ] Use Stripe Checkout (hosted page) before custom flows — saves weeks of PCI compliance.
- [ ] Set up the webhook endpoint EARLY (subscription events fire async). Use the Stripe CLI to forward webhooks locally during dev.
- [ ] Store the Stripe customer ID on your Supabase user row so you can correlate webhook events back to the right user.

### Replicate (background removal + other ML models)

**When to add it.** You need to run an ML model you do not want to host yourself — background removal, image upscaling, audio transcription.

**Setup checklist:**

- [ ] Sign up at replicate.com, get an API token.
- [ ] Add `REPLICATE_API_TOKEN` to `.env.local` AND Vercel.
- [ ] `npm install replicate`.
- [ ] Start with the rembg model for background removal. Always call from a server route.
- [ ] Store the resulting URL in Supabase Storage — do not depend on Replicate hosting the file long-term.

### Apify (managed scraping)

**When to add it.** The project needs to import data from a public website that has no API — user-initiated, single-URL only.

**Purpose.** Managed scraper actors. Used for user-initiated single-URL imports (e.g. Rightmove listings).

**Setup checklist:**

- [ ] Sign up at apify.com, get an API token.
- [ ] Add `APIFY_API_TOKEN` to Supabase Edge Function env.
- [ ] Pi