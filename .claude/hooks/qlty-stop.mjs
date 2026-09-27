// Claude Code Stop hook: run `qlty check`, `qlty smells` and gitleaks on the
// files changed on this branch, and hand any findings back.
//
// Wired from .claude/settings.json (exec form: `node <this file>`). Contract, per
// https://code.claude.com/docs/en/hooks (verified 2026-09-27):
//   exit 0 -> Claude stops normally (stdout JSON may carry a systemMessage);
//   exit 2 -> Claude does NOT stop, and stderr is fed back to it as the reason.
//
// "Changed" means changed against the upstream branch: that is qlty's default
// (`--all` widens it). For gitleaks it is worked out here with git (below).
// Everything shares one 25s budget (the settings timeout is 30s):
//   1. qlty check   - lint; runs first because it matters most.
//   2. qlty smells  - complexity/duplication. Runs only if there is time. After
//                     a dirty check it needs at least SMELLS_MIN_MS left. It is
//                     capped so GITLEAKS_RESERVE_MS always remains for step 3.
//   3. gitleaks     - secrets. ONE `gitleaks dir` process over a temp copy of
//                     the changed files (standalone binary, not the Qlty plugin,
//                     which starts one process per file). Honours the repo's
//                     .gitleaksignore.
//
// Deliberately never gets in the way:
//   - qlty / gitleaks not installed -> that step is skipped silently.
//   - out of budget                 -> a note, and whatever finished is reported.
//   - a tool itself errors          -> a note, never a block (a broken scanner is
//                                      not the change's fault).
//   - same findings blocked twice already this session -> exit 0 with a note.
//     The Stop input has no stop_hook_active flag, so this counter is the only
//     thing preventing a loop when Claude cannot fix a finding.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BUDGET_MS = 25_000;
const SMELLS_MIN_MS = 4_000;
const GITLEAKS_RESERVE_MS = 3_000;
const MAX_GITLEAKS_FILES = 500;
const MAX_BLOCKS_PER_FINDING = 2;
const MAX_SECTION_CHARS = 3_000;

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function allow(message) {
  if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

function runs(candidate, versionArgs) {
  const probe = spawnSync(candidate, versionArgs, { encoding: "utf8", timeout: 5_000 });
  return probe.status === 0;
}

function findQlty() {
  const exe = process.platform === "win32" ? "qlty.exe" : "qlty";
  const candidates = [exe, path.join(os.homedir(), ".qlty", "bin", exe)];
  return candidates.find((c) => runs(c, ["--version"])) ?? null;
}

// PATH first; then winget's package folder on Windows, because a winget install
// only reaches PATH in shells started after it.
function findGitleaks() {
  const exe = process.platform === "win32" ? "gitleaks.exe" : "gitleaks";
  const candidates = [exe];
  const wingetPackages = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages")
    : null;
  if (wingetPackages && fs.existsSync(wingetPackages)) {
    for (const dir of fs.readdirSync(wingetPackages)) {
      if (dir.startsWith("Gitleaks.Gitleaks")) candidates.push(path.join(wingetPackages, dir, exe));
    }
  }
  return candidates.find((c) => runs(c, ["version"])) ?? null;
}

function run(cmd, args, cwd, timeout) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout, maxBuffer: 16 << 20 });
  const timedOut = result.error?.code === "ETIMEDOUT" || Boolean(result.signal);
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", timedOut };
}

function clip(text) {
  return text.length > MAX_SECTION_CHARS
    ? `${text.slice(0, MAX_SECTION_CHARS)}\n… (truncated; run the command for the full list)`
    : text;
}

function gitLines(args, cwd) {
  const r = run("git", args, cwd, 5_000);
  return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : null;
}

// Files changed against the default branch (committed or not) plus untracked
// ones, relative to the repo root. Deleted files are excluded (nothing to scan).
function changedFiles(cwd) {
  const head = gitLines(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], cwd)?.[0] ?? "origin/main";
  const base = gitLines(["merge-base", "HEAD", head], cwd)?.[0];
  if (!base) return null;
  const tracked = gitLines(["diff", "--name-only", "--diff-filter=ACMR", base], cwd);
  const untracked = gitLines(["ls-files", "--others", "--exclude-standard"], cwd);
  if (!tracked || !untracked) return null;
  return [...new Set([...tracked, ...untracked])];
}

const started = Date.now();
const remaining = () => BUDGET_MS - (Date.now() - started);
const input = readInput();
const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
if (!fs.existsSync(path.join(projectDir, ".qlty", "qlty.toml"))) allow();

const notes = [];
const qlty = findQlty();

// 1. Lint (qlty exits 1 when it found issues; anything else non-zero is qlty failing).
let checkReport = "";
let checkLines = "";
let checkDirty = false;
let checkTimedOut = false;
if (qlty) {
  const check = run(qlty, ["check", "--no-progress", "--no-upgrade-check"], projectDir, remaining() - GITLEAKS_RESERVE_MS);
  checkTimedOut = check.timedOut;
  if (check.timedOut) {
    notes.push("qlty check did not finish in time; run `qlty check` before committing.");
  } else if (check.status === 1) {
    checkReport = `${check.stdout}${check.stderr}`.trim();
    checkDirty = true;
    // Issue lines ("  1:1  medium  message  plugin:rule") plus file headers are
    // stable run to run; the surrounding text is not.
    checkLines = check.stdout
      .split(/\r?\n/)
      .filter((line) => /^\s+\d+:\d+\s/.test(line) || /^\S.*:\d+:\d+\s*$/.test(line))
      .join("\n");
  } else if (check.status !== 0) {
    notes.push(`qlty check errored (exit ${check.status}); lint not checked. Run \`qlty check\` to see why.`);
  }
}

// 2. Smells: complexity, nesting, duplication. Exits 0 either way, so parse.
let smellsReport = "";
if (qlty) {
  const smellsBudget = remaining() - GITLEAKS_RESERVE_MS;
  if (checkTimedOut || smellsBudget < 1_000 || (checkDirty && smellsBudget < SMELLS_MIN_MS)) {
    notes.push("qlty smells skipped (time budget); run `qlty smells` before marking the PR ready.");
  } else {
    const smells = run(qlty, ["smells", "--quiet", "--no-snippets", "--no-upgrade-check"], projectDir, smellsBudget);
    if (smells.timedOut) {
      notes.push("qlty smells did not finish in time; run `qlty smells` before marking the PR ready.");
    } else if (smells.status === 0) {
      // Findings look like "   7  Deeply nested control flow (level = 5)" under a file header.
      const hasFindings = smells.stdout.split(/\r?\n/).some((line) => /^\s+\d+\s{2}\S/.test(line));
      if (hasFindings) smellsReport = smells.stdout.trim();
    } else {
      notes.push(`qlty smells errored (exit ${smells.status}); run \`qlty smells\` to see why.`);
    }
  }
}

// 3. Secrets: one gitleaks process over a temp copy of the changed files, so the
// report's paths (and so the fingerprints .gitleaksignore matches on) are
// repo-relative.
let secretsReport = "";
let secretsKey = "";
const gitleaks = findGitleaks();
const files = gitleaks ? changedFiles(projectDir) : null;
if (gitleaks && files === null) {
  notes.push("gitleaks skipped (could not list changed files).");
} else if (gitleaks && files.length > MAX_GITLEAKS_FILES) {
  notes.push(`gitleaks skipped (${files.length} changed files); run \`gitleaks dir .\` before committing.`);
} else if (gitleaks && files.length > 0) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qlty-stop-gitleaks-"));
  try {
    for (const rel of files) {
      const from = path.join(projectDir, rel);
      if (!fs.existsSync(from) || !fs.statSync(from).isFile()) continue;
      const to = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
    const ignore = path.join(projectDir, ".gitleaksignore");
    const args = ["dir", ".", "--no-banner", "--redact", "--exit-code", "0", "-f", "json", "-r", "-", "-l", "error"];
    if (fs.existsSync(ignore)) args.push("-i", ignore);
    const leaks = run(gitleaks, args, tmp, Math.max(remaining(), 1_000));
    if (leaks.timedOut) {
      notes.push("gitleaks did not finish in time; run `gitleaks dir .` before committing.");
    } else if (leaks.status !== 0) {
      notes.push(`gitleaks errored (exit ${leaks.status}); run \`gitleaks dir .\` to see why.`);
    } else {
      let findings = [];
      try {
        findings = JSON.parse(leaks.stdout || "[]");
      } catch {
        notes.push("gitleaks output could not be parsed; run `gitleaks dir .` to see why.");
      }
      if (findings.length) {
        const lines = findings.map((f) => {
          const file = String(f.File).replaceAll("\\", "/");
          return `${file}:${f.StartLine}  ${f.RuleID}  ${f.Description}\n    fingerprint: ${file}:${f.RuleID}:${f.StartLine}`;
        });
        secretsReport = lines.join("\n");
        secretsKey = findings.map((f) => `${f.File}:${f.RuleID}:${f.StartLine}`).sort().join("\n");
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (!checkReport && !smellsReport && !secretsReport) allow(notes.join(" ") || undefined);

// Loop guard, keyed per session and per exact set of findings.
const stateDir = input.scratchpad_dir || os.tmpdir();
const stateFile = path.join(stateDir, `qlty-stop-${input.session_id ?? "nosession"}.json`);
const hash = createHash("sha256")
  .update(`${checkLines || checkReport}\n--smells--\n${smellsReport}\n--secrets--\n${secretsKey}`)
  .digest("hex");
let state = {};
try {
  state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
} catch {}
const count = state.hash === hash ? (state.count ?? 0) : 0;
if (count >= MAX_BLOCKS_PER_FINDING) {
  allow("The quality gate still reports the same findings after two attempts; not blocking again. Fix or explain them before committing.");
}
try {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ hash, count: count + 1 }));
} catch {}

const sections = ["Quality gate (CLAUDE.md): issues found in files changed on this branch."];
if (secretsReport) {
  sections.push(
    `## Secrets (gitleaks): remove any real secret (then rotate it; it may already be in history). ` +
      `If one is a verified false positive, add its fingerprint to .gitleaksignore with a comment saying why\n\n${clip(secretsReport)}`,
  );
}
if (checkReport) {
  sections.push(`## Lint (qlty check): fix these, or say why one cannot be fixed\n\n${clip(checkReport)}`);
}
if (smellsReport) {
  sections.push(
    `## Smells (qlty smells): fix any this branch introduced; pre-existing smells in a touched file can stay (say so)\n\n${clip(smellsReport)}`,
  );
}
if (notes.length) sections.push(`Notes: ${notes.join(" ")}`);
process.stderr.write(`${sections.join("\n\n")}\n`);
process.exit(2);
