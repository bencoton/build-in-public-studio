# Session log

Append-only. Newest entry at the top.

---

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
