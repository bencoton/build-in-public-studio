# Plan

*Plan as of 2026-05-24. Living document — update as phases complete or scope shifts. `PROJECT.md`'s "Current phase" should always match the current phase here.*

---

## Phase 0 — Scaffolding (this session)

**Goal:** the dashboard renders end-to-end on `localhost:3000` and the project conforms to WyCo conventions before any feature code is written.

**Done when:**

- `docs/` contains the three WyCo reference docs.
- `PROJECT.md`, `CLAUDE.md`, `NOTES.md`, `KNOWN-ISSUES.md` exist at the root with correct content.
- Visual layer uses Space Grotesk (headings), Inter (body), JetBrains Mono (code), WyCo teal primary, slate-900 dark background.
- `npm install` runs cleanly in PowerShell.
- `npm run dev` opens to a working dashboard placeholder.
- First commit pushed to a private GitHub repo `bencoton/build-in-public-studio`.

---

## Phase 1 — Local MVP (the 10 stages of the original spec)

**Goal:** a local tool that, every Monday morning, drafts shippable build-in-public posts from the past week of GitHub activity and notes — and learns Ben's voice as he stars posts that work.

| Stage | What ships | Verified by |
|---|---|---|
| 2 | SQLite schema + `/notes` page | Ben adds a note, sees it persist |
| 3 | Settings page + `.env.local` walk-through (Anthropic key, GitHub token) | Each key validates with a smoke-test call |
| 4 | GitHub sync — Octokit pulls commits from watched repos | Debug page shows raw commit list |
| 5 | Claude drafting for one moment | One real moment renders both X thread + IH long-form variants |
| 6 | Full dashboard with all draft variants, edit / regenerate / approve / reject buttons | All states reachable from UI |
| 7 | Copy + Open flow (X and Indie Hackers) + "Did you publish it?" follow-up | Round-trip from approve → paste → URL captured |
| 8 | `/history` page + voice learning loop (starred posts fed into future prompts) | Star a post, see voice shift |
| 9 | Scheduler (node-cron, Mondays 9am) + desktop notifications | Cron fires, notification appears, drafts arrive |
| 10 | Polish pass — animations, empty states, error handling, loading skeletons, light-mode toggle | Whole app holds up to the WyCo style guide |

Each stage stops for verification before the next starts.

---

---

## Phase 1.5 — Product summaries + scheduled-batch posting

*Added 2026-05-25 mid-build after Ben used the working tool and surfaced two missing capabilities. Both are real product extensions, not polish. Scoped together with Ben before pausing.*

### 1.5a — Product summaries (per-project, structured)

**Goal:** generate product-level marketing copy from the project's metadata + history, separate from the weekly moment-drafting flow.

**Two outputs per run:**

1. **Website summary** — structured: tagline (≤80 chars) + 2-3 paragraphs of about-page prose + a short feature list. Drawn from `PROJECT.md`, recent commits, recent notes.
2. **Launch announcement** — an X thread + an Indie Hackers long-form that *announce* the product, written in the user's build-in-public voice. Leans into the "100% Claude-generated" credibility hook.

**Scope:** per-project (run once per repo). Lives on a new sidebar item, "Summaries". Outputs persist in a new `summaries` table — schema TBD but probably `{id, repo, kind, content_structured (JSON), created_at}`.

**Done when:**

- New "Summaries" page accessible from the sidebar.
- Project picker on the page.
- Two buttons: "Generate website summary" / "Generate launch announcement".
- Each output rendered with copy-to-clipboard.
- Outputs persist across sessions so the user can refer back without regenerating.

### 1.5b — Batch from previous work + scheduling

**Goal:** generate 10–15 moments from a custom historical window (longer than 7 days) and stagger their release across the coming weeks. Lets the user "catch users up on the journey" for products that have been quietly in development.

**Scope:**

- Custom time window. Presets: 30 / 90 / 180 days / "since project start" (uses the repo's first commit). Per-project.
- Generates more moments than the weekly batch — say 10–15 (configurable). May need `max_moments` parameter on `generateDrafts()`.
- **Auto-suggested release dates with user override** — auto-stagger one per ~2 days starting tomorrow, user can drag/edit each date.
- New `scheduled_for TEXT` column on `drafts` (nullable, ISO timestamp).
- New "Queue" view (probably `/queue`) — calendar-style or date-sorted list of scheduled posts. Status shows "Due soon" when within 24h, "Due now" past the date.
- Desktop notification when a scheduled post's date arrives — reuses Stage 9's notification plumbing. **Never auto-publishes** per the Copy+Open philosophy.

**Done when:**

- "Generate batch from history" flow on the Summaries page (or a new page).
- Window selector + moment-count input.
- Generated batch renders with editable per-post dates.
- "Queue" sidebar item shows upcoming scheduled posts.
- Notification fires when a post's scheduled time arrives.

### Sequencing recommendation

Build Stage 9 first — its notification + cron infrastructure is the foundation that 1.5b reuses. Then 1.5a (smaller, independent, immediately useful). Then 1.5b. Then Stage 10 polish. Then Phase 2 OSS launch.

---

## Phase 2 — OSS launch

**Goal:** the GitHub repo flips to public and the project is presented as a finished local tool that anyone can clone and run. This is the credibility milestone.

**Done when:**

- Repo is public on github.com/bencoton/build-in-public-studio.
- README is polished for first-time visitors (the version we ship in Phase 0 is the starting point — gets a polish pass at Phase 2 with screenshots).
- A short launch post (X thread + IH long-form) drafted *by the tool itself* (the meta-loop is the launch).
- Posted on Indie Hackers, X, and any other relevant communities.

---

## Phase 3 — Hosted SaaS (only if Phase 2 signals are green)

**Conditional on:** real strangers installing the OSS version *and* at least a handful explicitly asking "would you host this for me". If those signals don't appear, Phase 3 is shelved indefinitely.

**Goal:** a paid hosted version at the cheapest viable price.

**Stack switch:** drop `better-sqlite3` for Supabase. Adopt Vercel for hosting per `docs/Tech-Stack.md` Part 1. Add Supabase Auth (magic link), Stripe Checkout for subscriptions, Resend for transactional email. Move from PAT-based GitHub access to GitHub OAuth.

**Pricing:** £20/year, BYO Anthropic and GitHub keys. Free tier capped at 1 weekly generation, no voice learning, no scheduler. See market-research notes from 2026-05-24 session for the full economics.

**Open questions to resolve before starting Phase 3:**

- Is BYO-keys onboarding too high-friction? Is metered usage on a hosted Anthropic key viable instead?
- Does the moments-over-commits thesis hold up after 6+ weeks of Ben's own usage?
- Are existing competitors (Notra, OpenTweet, PersonaBox, Posterly, Commit To X) closing the gap?
