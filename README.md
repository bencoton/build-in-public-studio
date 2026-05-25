# Build-in-Public Studio

A local web dashboard that pulls your week's GitHub activity and weekly notes, asks Claude to identify story-worthy moments, and drafts X threads and Indie Hackers long-form posts for each. You review, edit, approve, and one-click "Copy + Open" the right platform to publish.

**Status:** scaffolding (Phase 0 of 3). See [`docs/PLAN.md`](./docs/PLAN.md) for the roadmap.

**Built by:** Ben Coton — a beginner-leaning developer experimenting with what AI-assisted development can ship. **100% of the code in this repo is Claude-generated.** Every line. That is not a footnote; it is the whole point. See [Why this exists](#why-this-exists) below.

---

## What it does

- **Watches your repos.** Pulls commits, PR titles, and file-change summaries from the GitHub repos you've selected.
- **Reads your notes.** A quick-capture page where you write down the "why" behind the work — the parts a `git log` will never see.
- **Drafts on a weekly rhythm.** Every Monday at 9am (configurable), it asks Claude to find 3–5 *moments* worth posting about and drafts two variants for each: an X thread and an Indie Hackers long-form post.
- **You stay in the loop.** Edit, regenerate, approve, or reject every draft. Nothing auto-publishes — ever.
- **Copy + Open to publish.** One button: copies the post to your clipboard and opens the new-post page for X or Indie Hackers. You paste, tweak, hit publish.
- **Learns your voice.** Star the posts that worked. Future drafts pull from those examples — the writing gets closer to yours every week.

---

## Why this exists

There are already several tools that turn GitHub commits into social posts. None of them quite fit how *building in public* actually works. Specifically:

1. **Commits aren't stories.** `fix typo` is not a story. `refactor auth` might be. Most of the existing tools draft one post per commit, which floods your timeline with noise. This tool groups by *moments* — a story-worthy chunk of work — and asks Claude to pick what's worth saying.
2. **The interesting parts live in your notes, not your repo.** "3 hours debugging one missing `await`" is the post people share. That detail is in your head, not your `git log`. This tool lets you jot down those moments during the week and weaves them into the Monday drafts.
3. **Auto-publishing is risky.** The other tools post for you. That sounds convenient and is actually a brand-damage minefield — AI-drafted posts that go live without a human read produce embarrassing output more often than you'd like. This tool deliberately keeps you in the loop with a Copy + Open flow.
4. **Voice has to learn.** The first draft is generic. The tenth, after you've starred a handful of posts that worked, sounds like you.

The other reason it exists is to be a credibility artefact in its own right. The whole codebase is public. Everything Claude wrote (and everything that didn't quite work the first time) is in the git history. If you're curious what AI-assisted development looks like when a beginner-leaning developer is steering, this is a worked example.

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + a small set of shadcn/ui-style components (Button, Card)
- **SQLite** via `better-sqlite3` for storage — a single file in the project root, no external database
- **Anthropic SDK** (`@anthropic-ai/sdk`) for Claude
- **Octokit** for GitHub
- **node-cron** for the Monday scheduler

Local-only by design. Nothing leaves your machine except calls to the GitHub and Anthropic APIs, using your own keys. No telemetry. No accounts.

---

## Install

### Prerequisites

- **Node.js 18+** (run `node --version` to check) — get it from [nodejs.org](https://nodejs.org) if missing
- A code editor (VS Code is the easy default)
- An Anthropic API key — covered in the Stage 3 walkthrough
- A GitHub fine-grained personal access token — also covered in Stage 3

### First-time setup (PowerShell on Windows)

```powershell
# 1. Clone the repo and cd in
git clone https://github.com/bencoton/build-in-public-studio.git
cd build-in-public-studio

# 2. Install dependencies (takes 1–3 minutes the first time)
npm install

# 3. Copy the env template and fill in your keys
Copy-Item .env.local.example .env.local
notepad .env.local

# 4. Start the dev server
npm run dev
```

Then open <http://localhost:3000> in your browser.

### Setup on macOS / Linux

```bash
git clone https://github.com/bencoton/build-in-public-studio.git
cd build-in-public-studio
npm install
cp .env.local.example .env.local
$EDITOR .env.local
npm run dev
```

---

## How to get each API key

Detailed walkthroughs land with Stage 3. In short:

- **Anthropic** — sign up at <https://console.anthropic.com/>, create a key, paste into `.env.local` as `ANTHROPIC_API_KEY=...`
- **GitHub** — create a fine-grained token at <https://github.com/settings/tokens?type=beta> with read access to the repos you want to watch, paste into `.env.local` as `GITHUB_TOKEN=...`

Never commit `.env.local`. It's already in `.gitignore`.

---

## Troubleshooting

### `npm install` fails or hangs

Delete `node_modules` and `package-lock.json`, then re-run:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
```

### Port 3000 is already in use

Either close whatever's already on 3000, or run on 3001 instead:

```powershell
npm run dev -- -p 3001
```

### The dashboard loads but looks unstyled

Tailwind probably isn't compiling. Stop the dev server (`Ctrl+C`), then restart with `npm run dev` — Tailwind picks up `globals.css` on boot.

---

## Roadmap

The full phased plan lives in [`docs/PLAN.md`](./docs/PLAN.md). Headline:

- **Phase 0 — Scaffolding.** Project set up, dashboard placeholder renders.
- **Phase 1 — Local MVP.** All 10 stages of the original spec: SQLite, settings, GitHub sync, Claude drafting, full dashboard, Copy + Open flow, history with voice learning, scheduler, polish.
- **Phase 2 — OSS launch.** Repo flips public, README polishes for visitors, launch posts drafted *by the tool itself*.
- **Phase 3 — Hosted SaaS** *(conditional)*. If strangers install the OSS version and ask for a hosted version, ~£20/year hosted tier with bring-your-own keys.

---

## Credits

- **Code:** 100% Claude (Anthropic) under Ben Coton's direction. Method, hard-won lessons, and the AI-development workflow documented in [`docs/Ways-of-Working.md`](./docs/Ways-of-Working.md).
- **Visual brand:** the [WyCo Digital style guide](./docs/WYCO-DIGITAL-STYLE-GUIDE.md).
- **Open-source dependencies:** Next.js, React, Tailwind, lucide-react, better-sqlite3, Octokit, the Anthropic SDK, node-cron. Full list in [`package.json`](./package.json).

---

## License

To be added before the OSS launch (Phase 2). The current intention is MIT.
