import sql from "./db";
import {
  MAX_SUBS_PER_GENERATE,
  isValidSlug,
  normalizeSlug,
} from "./reddit-subs";

/*
  Key-value settings, backed by Postgres. Used for:
    - watched_repos    (JSON string-array of "owner/repo")
    - schedule_cron    (the user's cron expression)
    - banned_words     (newline-separated list)
    - style_notes      (free-form text baked into the Claude prompt)
    - last_run_at      (ISO timestamp of the most recent successful generation)

  All exported functions are async. Callers in server actions and server
  components need to await them.
*/

/** Read a single setting value, or undefined if not set. */
export async function getSetting(key: string): Promise<string | undefined> {
  try {
    const rows = await sql<Array<{ value: string }>>`
      SELECT value FROM settings WHERE key = ${key} LIMIT 1
    `;
    return rows[0]?.value;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`getSetting(${key}): ${msg}`);
  }
}

/** Upsert a setting. Bumps updated_at explicitly because Postgres's
 *  DEFAULT now() only fires on INSERT, not on the UPDATE half of an upsert. */
export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${value}, now())
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`setSetting(${key}): ${msg}`);
  }
}

// ── Typed convenience wrappers ─────────────────────────────────────────────

/** Watched GitHub repos, stored as a JSON array of "owner/name" strings. */
export async function getWatchedRepos(): Promise<string[]> {
  const raw = await getSetting("watched_repos");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((r): r is string => typeof r === "string")
      : [];
  } catch {
    return [];
  }
}

export async function setWatchedRepos(repos: string[]): Promise<void> {
  await setSetting("watched_repos", JSON.stringify(repos));
}

/** Cron expression for the twice-weekly generation. Mondays + Thursdays at
 *  9am Europe/London. The actual Vercel Cron fires at 08:00 UTC Mon+Thu (=
 *  09:00 UK during BST, 08:00 UK during GMT); the value stored here is the
 *  user-facing Europe/London expression that the AppHeader passes to
 *  cron-parser with tz: "Europe/London" for the "Next run" countdown. */
const DEFAULT_SCHEDULE_CRON = "0 9 * * 1,4";

export async function getScheduleCron(): Promise<string> {
  return (await getSetting("schedule_cron")) ?? DEFAULT_SCHEDULE_CRON;
}

export async function setScheduleCron(cron: string): Promise<void> {
  await setSetting("schedule_cron", cron);
}

/** Banned words baked into the Claude prompt. One per line. */
export async function getBannedWords(): Promise<string[]> {
  const raw = await getSetting("banned_words");
  if (!raw) return [];
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function setBannedWords(words: string[]): Promise<void> {
  await setSetting("banned_words", words.join("\n"));
}

/** Free-form style notes baked into the prompt. */
export async function getStyleNotes(): Promise<string> {
  return (await getSetting("style_notes")) ?? "";
}

export async function setStyleNotes(notes: string): Promise<void> {
  await setSetting("style_notes", notes);
}

// ── Per-project Reddit auto-generation subs ────────────────────────────────
//
// Which subreddits the normal Generate run should auto-draft for, per repo.
// Stored as a JSON slug array under `reddit.subs.<repo>`. Unset/empty = OFF
// (opt-in — repos with no selection make zero Reddit calls). Slugs are now
// freeform (user-managed catalog) — validated for FORMAT (not against a fixed
// union), deduped case-insensitively, and capped at MAX_SUBS_PER_GENERATE on
// both read and write so a hand-edited/stale value can't exceed the budget or
// smuggle in a malformed slug. A stored slug whose catalog entry was later
// removed stays valid here and just falls back to a generic steer at draft time.

function normalizeSubs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const slug = normalizeSlug(v);
    const key = slug.toLowerCase();
    if (isValidSlug(slug) && !seen.has(key)) {
      seen.add(key);
      out.push(slug);
    }
  }
  return out.slice(0, MAX_SUBS_PER_GENERATE);
}

export async function getRedditSubs(repo: string): Promise<string[]> {
  const raw = await getSetting(`reddit.subs.${repo}`);
  if (!raw) return [];
  try {
    return normalizeSubs(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function setRedditSubs(
  repo: string,
  subs: string[],
): Promise<void> {
  await setSetting(`reddit.subs.${repo}`, JSON.stringify(normalizeSubs(subs)));
}

/** Drop a slug from every project's selection — used when a sub is removed
 *  from the catalog (spec OQ2) so a deleted sub doesn't linger in selections. */
export async function removeSubFromAllProjects(slug: string): Promise<void> {
  const repos = await getWatchedRepos();
  for (const repo of repos) {
    const subs = await getRedditSubs(repo);
    if (subs.includes(slug)) {
      await setRedditSubs(
        repo,
        subs.filter((s) => s !== slug),
      );
    }
  }
}

/** Last successful generation timestamp (ISO 8601). Null if never run. */
export async function getLastRunAt(): Promise<string | null> {
  return (await getSetting("last_run_at")) ?? null;
}

export async function setLastRunAt(iso: string): Promise<void> {
  await setSetting("last_run_at", iso);
}
