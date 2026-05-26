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

### Backend layer — Neon + Better Auth + Cloudflare R2 (since 2026-05-26)

> **Stack change.** Until 2026-05-26 this section was a single Supabase entry. The backend is now a three-provider stack assembled per-layer. See [`decisions/ADR-001-supabase-to-neon.md`](./decisions/ADR-001-supabase-to-neon.md) for the why. The Supabase-era version of this section is preserved in git history.

**Purpose.** Database, auth, file storage, and tenant isolation — assembled from three best-in-class managed services instead of one all-in-one vendor.

**Why this one.** Per-project cost is £0 on free tiers (vs Supabase's $10/extra-project tax). Real Postgres so SQL migrations port forwards. Better Auth keeps user data in our own DB (no auth-vendor lock-in). R2's no-egress-fee model eliminates "scaling surprise" bills.

#### Database — Neon (Postgres)

**Decisions baked in:**

- **Region: London (AWS eu-west-2).** UK data residency by default.
- **Free tier covers up to 10 projects per account.** Launch tier ($5/mo) covers 1,000 projects with usage-based pricing on top. Per-project cost is effectively zero.
- **Use the pooled connection string** for Vercel serverless functions (Neon dashboard surfaces both "Direct" and "Pooled" — Vercel always wants Pooled).
- **Migrations only.** All schema changes are SQL migration files in `/migrations/` (since we no longer have the Supabase CLI's `/supabase/migrations/` convention, the canonical path is now plain `/migrations/`). Apply with the migration runner of your choice — see `Neon-Reference.md`.
- **Row-level filtering happens in the query layer**, not at the DB level. Without Supabase Auth's `auth.uid()`, we cannot use Postgres RLS the same way. Instead, every server-side query is wrapped with a `withSession(req)` helper that injects the current Better Auth user ID into the `WHERE` clause. See `Better-Auth-Reference.md` Pattern 3.
- **No service-role-equivalent for client code.** All DB access goes through server-side API routes or server components. Never expose the Neon connection string to the browser bundle.

**Setup checklist:**

- [ ] Create a free Neon account at `https://neon.com` (sign in with GitHub for easier Vercel integration).
- [ ] Create a project named `<project-slug>`, Postgres 16, region `AWS eu-west-2 (London)`.
- [ ] Copy the **pooled** connection string. Add to `.env.local` as `DATABASE_URL`.
- [ ] Add the same `DATABASE_URL` to Vercel (Settings → Environment Variables, all three environments).
- [ ] Install the DB client: `npm install postgres` (`postgres.js`, lightweight, no native deps).
- [ ] Create `src/lib/db.ts` exporting a `sql` template-tag function (boilerplate in `Neon-Reference.md`).
- [ ] Write the first migration as `migrations/0001_initial_schema.sql`. Apply via Neon's web SQL editor or `psql`.
- [ ] Generate TypeScript types: see `Neon-Reference.md` "Generating types" — uses `kysely-codegen` or `prisma-introspect`, no PowerShell encoding pitfall (Lesson L2 obsolete).

#### Auth — Better Auth (open-source library, runs on Vercel)

**Decisions baked in:**

- **Free forever.** Open source TypeScript library. No SaaS bill, no MAU caps.
- **Stores users in your Neon DB** in a `user` + `session` + `account` table set. Initial schema is migration-generated by the Better Auth CLI on install.
- **Email + Google + GitHub OAuth** are the standard providers. Add others (Apple, Microsoft, etc.) only when a specific project needs them.
- **Session model: server-side cookies.** No JWT in localStorage. Sessions live in the `session` table; cookie is HTTPOnly + Secure + SameSite=Lax.
- **Multi-tenancy pattern: organisation table** in app schema, joined to `user.id`. Every tenant-scoped query joins on `current_organization_id` resolved from the Better Auth session. See `Better-Auth-Reference.md` Pattern 4.
- **Fallback escape hatch:** if Better Auth ever fails us in production, swap to Clerk (10K MAU free tier, then $25/month) with one env-var change. The `withSession()` query helper hides the auth provider from the rest of the app.

**Setup checklist:**

- [ ] Install: `npm install better-auth`.
- [ ] Run the Better Auth CLI: `npx @better-auth/cli init` — generates schema migration for `user` / `session` / `account` tables.
- [ ] Apply the generated migration via the Neon SQL editor.
- [ ] Create `src/lib/auth.ts` exporting the configured `auth` instance (template in `Better-Auth-Reference.md`).
- [ ] Add OAuth provider env vars to `.env.local` and Vercel: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` as needed.
- [ ] Add `BETTER_AUTH_SECRET` (32+ char random string — `openssl rand -base64 32` in Cowork's bash, or use a password manager).
- [ ] Wire up the `/api/auth/[...all]` catch-all route.
- [ ] Add the `withSession()` query-layer wrapper before writing any tenant-scoped server code.

#### File storage — Cloudflare R2

**Decisions baked in:**

- **10 GB free, then $0.015/GB-month.** No egress fees ever. 1M class-A operations + 10M class-B operations free per month.
- **Use the S3-compatible API** via `@aws-sdk/client-s3` — portable skill, works against R2, AWS S3, MinIO, Backblaze without code changes.
- **Bucket per project**, not per environment. Use prefixes (`prod/`, `staging/`) inside the bucket if environment separation is needed.
- **Auto-cleanup of user-uploaded media after 12 months** — same retention policy as the Supabase era. Implemented as a Vercel Cron job that runs against R2 lifecycle rules (configured in the R2 dashboard).
- **Signed URLs for private files.** Never make user-content buckets publicly listable. Generate short-lived (15 min default) presigned URLs on-demand from server routes.

**Setup checklist:**

- [ ] Create a free Cloudflare account at `https://dash.cloudflare.com`.
- [ ] R2 → Create bucket → name `<project-slug>-storage`.
- [ ] R2 → Manage R2 API Tokens → Create API token, permissions: `Object Read & Write` on this bucket only.
- [ ] Save the Access Key ID + Secret Access Key + account ID + endpoint URL.
- [ ] Add to `.env.local` and Vercel: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`.
- [ ] Install: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.
- [ ] Create `src/lib/storage.ts` with `uploadFile()` / `getSignedReadUrl()` / `deleteFile()` helpers (template in `R2-Reference.md`).
- [ ] Configure R2 lifecycle rule in the dashboard for the 12-month auto-delete.

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
- [ ] Pick the actor for your target site (e.g. Rightmove scraper). Store `APIFY_<TARGET>_ACTOR_ID`.
- [ ] Endpoint: `POST https://api.apify.com/v2/acts/<actor-id>/run-sync-get-dataset-items?token=<token>` with `{ startUrls: [{ url }] }`. 60s timeout, single retry on 5xx.
- [ ] Treat Apify-returned structured fields as **Tier 1** in cascades (agent-authored, Trading-Standards bound).
- [ ] **Run an audit endpoint on the source first** (see `Ways-of-Working.md` Lesson L12) — the "missing" field is often present under a different name.
- [ ] Jitter outbound fetches to portal hosts (200-800ms randomised). The Apify call itself does not need jitter — it is your vendor.

### eBay APIs (Sell + Browse)

**When to add it.** The project lists items on eBay, pulls sold-price history, or syncs inventory.

**Setup checklist:**

- [ ] Sign up for an eBay developer account.
- [ ] Create an application keyset (sandbox first, then production).
- [ ] OAuth setup is fiddly — budget half a day. Use the User Token flow for actions on behalf of a logged-in user.
- [ ] Store refresh tokens in Supabase, scoped per user, RLS-locked.
- [ ] Add `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` to env.
- [ ] Wrap every eBay call in retry-with-backoff — their rate limits and 5xx rates are higher than expected.

### ScrapingBee (fallback web scraping)

**When to add it.** You need to read content from a site that has no API AND Apify has no actor for it.

**Setup checklist:**

- [ ] Sign up at scrapingbee.com, get an API key.
- [ ] Add `SCRAPINGBEE_API_KEY` to `.env.local` AND Vercel.
- [ ] Use sparingly — per-credit. Cache aggressively.
- [ ] Pair with Anthropic API for "scrape + extract structured fields" pipelines.

### Property data — HM Land Registry + Homedata + Nominatim

**When to add it.** UK property products (ReConfig, etc.). Used for value cascades, address resolution, sold-price intelligence.

| Service | Use | Notes |
|---|---|---|
| **HM Land Registry** | Tier 1 of value cascade. Public SPARQL endpoint at `https://landregistry.data.gov.uk/landregistry/query`. Free, official, type-matched. | 30-day TTL cache (LR refreshes monthly). 12s timeout + single retry. No documented rate limit. |
| **Homedata** | Primary UK property data API — sold-price history, EPC, council tax band, predicted price. | Add `HOMEDATA_API_KEY` to Edge Function env. |
| **Nominatim** | Tier 2 address resolution fallback. OpenStreetMap free geocoder. | 1 req/sec limit. Use when Apify `outcode + incode` is incomplete. |

### Expo (mobile, when starting from a web project)

**When to add it.** A project that started as web (Next.js) now needs a mobile app.

**Setup checklist:**

- [ ] `npx create-expo-app@latest <project-name>-mobile` in a SIBLING folder (NOT inside the Next.js repo — keep them as separate git repos).
- [ ] Reuse the Supabase client and types from `src/types/database.ts` — copy across or publish as a tiny shared package later.
- [ ] Use EAS for builds and OTA updates.
- [ ] **Apple TestFlight review takes 24-48h per build the first time.** Plan accordingly.

### shadcn/ui

**When to add it.** The web UI is getting beyond raw Tailwind utility classes and you want consistent components.

**Setup checklist:**

- [ ] `npx shadcn@latest init` in the project root.
- [ ] Add components on demand: `npx shadcn@latest add button card dialog form input`.
- [ ] Resist installing the entire library at once — each component is added to `src/components/ui/` and tracked in git.

### React Email (HTML email templates)

**When to add it.** You are sending more than 1–2 email types via Resend and the inline HTML is getting unwieldy.

**Setup checklist:**

- [ ] `npm install @react-email/components react-email`.
- [ ] Create `emails/` folder; each template is a React component.
- [ ] Use `npm run email` (the react-email preview server) to iterate on designs locally.
- [ ] Resend's SDK accepts React components directly — no manual render step needed.

### PDF generation — `pdf-lib`

**When to add it.** You need to generate PDFs server-side (reports, receipts).

**Why `pdf-lib`:** pure JS, no React, no dynamic asset imports — boots cleanly in Deno first try. `@react-pdf/renderer` did not run reliably inside Deno's npm shim.

**Setup checklist:**

- [ ] `npm install pdf-lib`.
- [ ] Run inside a Supabase Edge Function (`generate-report`).

### PostHog or Plausible (product analytics)

**When to add it.** You want to know whether the features you are shipping are actually being used.

**Setup checklist:**

- [ ] **Plausible** = lighter (script tag, marketing sites, early-stage MVPs).
- [ ] **PostHog** = heavier (SDK + event tracking + feature flags, once you have real users).
- [ ] Do not install both — pick one.
- [ ] **Tracking-plan first, instrument second.** Use the product-tracking skill in Cowork to design the plan before sprinkling SDK calls through the code.

### Sentry (error monitoring)

**When to add it.** Real users are on the site and you want to know about crashes before they tell you.

**Setup checklist:**

- [ ] Sign up at sentry.io, create a Next.js (or React Native) project.
- [ ] Run `npx @sentry/wizard@latest -i nextjs` — it handles the config files.
- [ ] Add `SENTRY_AUTH_TOKEN` to Vercel.
- [ ] Tune the sample rate down once you have traffic, or the free tier vanishes fast.

---

## Part 3 — Hosting and runtime split

Pick the runtime by workload duration, **not** by familiarity:

- **Vercel API routes (Node)** — long-running work (>60s typical). Used for AI analysis with streaming UX. 300s budget on Pro plan. Native SSE streaming.
- **Supabase Edge Functions (Deno)** — short transactional work (<60s typical). Cheap, fast boot, region-pinned in London. Used for imports, PDF generation, data fetches, email sending, image generation.

### Reference: where things run in `reconfig-app`

- **Vercel:** `analyse-property` (Anthropic vision + streaming).
- **Supabase Edge Functions:** `import-listing`, `generate-report`, `fetch-property-data`, `fetch-land-registry-comparables`, `enrich-address`, `generate-after-render`, `precompute-property`, `pre-screen-property`.

### Supabase Edge Functions — quirks to remember

- Cold start ~500ms. Fine for analysis (10-30s); feels slow for instant actions.
- Free tier wall-clock ~150s. Pro tier background task ~150s. Anything longer → Vercel.
- **Server-to-server invocations need `--no-verify-jwt` + manual apikey check.** Default JWT verifier rejects new `sb_secret_*` keys (see `Ways-of-Working.md` Lesson L13).
- Functions that share `_shared/` modules need **explicit redeploy of every consumer** when the shared module changes — the bundler re-includes shared code at deploy time, not runtime.

---

## Part 4 — Folder layout

Target structure for any new project. Adjust per shape (web-only / mobile-only / both).

```
my-new-app/
├── api/                  # Vercel serverless functions (long jobs only)
├── app/                  # Expo Router screens (mobile) OR Next.js App Router (web)
├── src/                  # If Next.js + --src-dir
│   ├── components/       # Shared UI components
│   ├── lib/              # Business logic (cost engine, viability, formatting)
│   └── types/            # Shared TypeScript types (incl. database.ts from Supabase)
├── components/           # If Expo (no src/)
├── lib/                  # If Expo
├── docs/                 # Ways of Working, Tech Stack, WYCO style guide, sprint specs
├── prompts/              # All AI prompt templates as .ts exports
├── supabase/
│   ├── migrations/       # SQL migrations
│   └── functions/        # Edge Functions (short jobs)
├── CLAUDE.md             # Project conventions + architectural rules (root)
├── NOTES.md              # Append-only session log (root)
├── KNOWN-ISSUES.md       # Bug + polish tracker (root)
└── package.json
```

---

## Part 5 — Environment variables (master list)

Add each one to BOTH `.env.local` AND Vercel (or Supabase Edge Function env) before its first use.

### Core (every project)

```bash
# Supabase (web — Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...      # server-only, never expose

# Supabase (mobile — Expo)
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
EXPO_PUBLIC_API_BASE_URL=https://<deploy>.vercel.app

# Email
RESEND_API_KEY=re_...

# AI (almost always)
ANTHROPIC_API_KEY=sk-ant-...
```

### Supabase Edge Function env (server-side only)

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
```

### Optional add-ons

```bash
REPLICATE_API_TOKEN=r8_...                # if using Replicate
SCRAPINGBEE_API_KEY=...                   # if using ScrapingBee

# Stripe (when payments land)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# eBay (when listing/syncing)
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...

# UK property data (ReConfig-style projects)
HOMEDATA_API_KEY=...
APIFY_API_TOKEN=...
APIFY_RIGHTMOVE_ACTOR_ID=...
IMPORT_RATE_IP_SALT=...                   # SHA-256 salt for IP hashing — never raw IPs

# Monitoring
SENTRY_AUTH_TOKEN=...                     # if using Sentry
```

---

## Part 6 — Security model

### Secrets

- **Never in the client.** All third-party API keys live in server-side env vars only (Supabase Edge Function env or Vercel env). Nothing in the mobile bundle or browser bundle.

### Admin allowlist — two layers (defence in depth)

- **Layer 1:** TypeScript constant `ADMIN_USER_IDS` in `lib/queries/admin.ts`. Gates client-side admin UI (`Settings → Admin`, `/admin/*` routes).
- **Layer 2:** RLS policies in `supabase/migrations/*.sql`. Gates actual data access. Same UUID duplicated into select/update policies for the relevant tables and storage buckets.

**Adding or removing an admin requires updating BOTH layers.** A rogue PR that only edits `ADMIN_USER_IDS` would render admin UI but every fetch would 403. No self-promotion path.

### Admin scope

Admins get **SELECT-only** on user data (browsing for support). They cannot mutate via these policies — server functions that legitimately mutate use the service-role client and are unaffected. Only mutation an admin can perform via the client is `UPDATE bug_reports.status`.

### Rate limits

- **Per-user:** e.g. 200 imports/day, 60 imports/hour. Logged to a per-user rate table.
- **Per-IP:** e.g. 500 imports/hour. Keyed by `SHA-256(salt + ip)` — never store raw IPs.
- **Salt rotation:** rotating the IP salt resets the window. Acceptable trade-off for stronger anonymity.
- **Server-to-server:** verify the service-role key explicitly (`sb_secret_*` keys are NOT JWTs — default JWT verifier rejects them).

### Data and privacy defaults

- Pick hosting in the right region (UK = London Supabase, EU data residency for Anthropic). Do not default to US/Asia.
- Do not store user-uploaded media beyond 12 months without explicit consent. Run a nightly cleanup job.
- Imported third-party content (listing photos, floor plans) belongs to the original owner. Display in the user's private workspace only — never on marketing pages, never republish.
- Disclaim everything that is not a hard fact: "estimate", "indicative", "subject to professional sign-off", "not financial / legal / investment advice".

---

## Part 7 — Architectural rules (reusable across projects)

The rules below are stack-level defaults. Lift them into each project's `CLAUDE.md`. Bug-class lessons live in `Ways-of-Working.md` Part 9.

1. **Secrets never in the client.** All third-party API keys live in server-side env vars only.
2. **Writes through a typed layer.** No raw `supabase.from(...).insert(...)` scattered across screens.
3. **Resize images client-side.** 1600px max longest edge before upload. Vision tokens are expensive; mobile bandwidth is annoying.
4. **Prompts in `/prompts/`.** Never inline a long prompt into business logic.
5. **`tool_use` for structured JSON.** Never parse free-form text from Claude.
6. **Cost engine is plain TypeScript** with hard-coded constants and a regional multiplier table. Resist making it "configurable" early — YAGNI.
7. **Migrations only.** Never edit production tables in the dashboard once you have real users.
8. **Telemetry from day one.** Log token usage to a `usage` table per user per call. Without this you cannot price tiers later.
9. **Imports are user-initiated, single-URL, rate-limited.** Never scrape search results, never crawl, never schedule background fetches.
10. **Cascade pattern.** Every user-facing figure resolves through tiered cascade helpers — most-specific source first, fall through to least-specific. The lowest tier always returns a sentinel with low confidence — **never blank**.
11. **Basis-block ordering.** Same field order on screen and PDF: section header → confidence indicator → headline value → source label → derived metrics → detail rows.
12. **Cross-surface parity.** Same headline figures on every surface (list / detail / PDF / dashboard) — all drawn from the same helpers. Per-surface fallback logic is a parity violation.
13. **Verify deploy chain before declaring code missing.** A parity gap can be missing code OR a stale deploy — same symptom, different fix.
14. **Listing-document vision is Tier 1.** Vision-extracted facts from agent-provided documents (floor plans, EPC certificates) are more reliable than statistical inference because the agent is Trading-Standards-bound to them.
15. **Apify-returned data is Tier 1.** Every structured field a managed scraper returns is agent-authored fact — promote each to Tier 1 of its respective cascade.
16. **Audit external API shape before designing fallbacks.** The "missing" field is often present under a different name, in a sub-object, or in description text. Cheap audit gates expensive fallback work. (See `Ways-of-Working.md` Lesson L12.)
17. **Description-text regex is Tier 1.5.** Property listings follow consistent agent-authored conventions for facts not in structured fields. Regex is free; try it before AI inference.
18. **Schema rigidity vs model reliability.** Hard-require only what the renderer needs to draw something useful. `minItems: 1` + prompt-side encouragement beats `minItems: 3`.
19. **`max_tokens` headroom + field ordering.** Audit worst-case output before deploying a schema expansion. Declare schema fields in priority order — the moat at position one.
20. **SDK retry defaults compound timeouts.** Set `maxRetries: 0` at construction. Orchestrate retries at the app layer where they are visible and logged.
21. **`Promise.all` by default.** Independent `await`s in a hot path collapse from `sum(legs)` to `max(legs)`.
22. **Hybrid runtime by workload.** Long jobs on Vercel. Short jobs on Supabase Edge Functions. Do not default to one out of familiarity.
23. **Two-pass for vision-heavy analysis.** Pass 1: photos in, structured text out. Pass 2: text in, structured recommendations out — no photos, much faster.
24. **Prompt caching for stable content.** Cache the system prompt and tool definitions. Do not cache per-request variable content (photos, listing facts).
25. **Pre-compute slow setup work.** Anything deterministic from `(entity_id, user_id)` that takes >5s belongs in a precompute pipeline fired off the moment-of-arrival.
26. **Photo subset selection for vision.** Cheap classification (Haiku) + one-per-room-class + always include floor plan + exterior. Cap at 6-8.
27. **Server-to-server EF calls.** Deploy callee with `--no-verify-jwt` + manual apikey check against service-role key. Default JWT verifier rejects `sb_secret_*` keys. (See `Ways-of-Working.md` Lesson L13.)

---

## Part 8 — Important commands

### Web (Next.js)

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server. |
| `npm run lint` | Run ESLint. Fix all warnings before committing. |
| `npm run typecheck` | TypeScript check. Must pass before committing. |
| `npm run build` | Production build (sanity-check locally before push). |

### Mobile (Expo)

| Command | What it does |
|---|---|
| `npx expo start` | Start Expo dev server. |
| `npx expo start --tunnel` | Use when your phone and laptop are on different networks. |
| `eas build --platform all` | Build iOS + Android via EAS cloud. |
| `eas update` | Push an OTA update to existing installs. |

### Supabase

| Command | What it does |
|---|---|
| `supabase migration new <name>` | Create a new SQL migration. |
| `supabase db push` | Apply local migrations to the remote Supabase project. |
| `supabase functions deploy <name>` | Deploy an Edge Function (and any of its consumers if shared modules changed). |
| `cmd /c "supabase gen types typescript --linked > src/types/database.ts"` | Regenerate DB types. (See Lesson L2 for why `cmd /c`.) |

### Git

| Command | What it does |
|---|---|
| `git status` | Run at the start of every Claude Code session. |
| `git log --oneline -5` | The other half of "state of the world". |
| `git restore .` | Recover working-tree corruption (Lesson L8). |

---

## Part 9 — Hard-won lessons archive (stack-specific)

*General bug-class lessons live in [`Ways-of-Working.md`](./Ways-of-Working.md) Part 9. Below are stack-level patterns specific to providers.*

### Anthropic

- Audit `max_tokens` against worst-case output. `stop_reason: "max_tokens"` is a silent failure mode — surface it explicitly.
- Declare schema fields in priority order. The model generates fields in the order they appear; truncation drops the tail.
- Schema rigidity inversely correlates with model output reliability. `minItems: 3` with 16 required sub-fields per item produces empty arr