import { db } from "./db";

/*
  Typed getter/setter for the `settings` table.

  Settings are stored as key/value text pairs. Callers convert to/from
  their own shapes (we use JSON for lists). Keeping the storage shape simple
  means future settings can be added without a migration.
*/

type SettingRow = { value: string };

/** Read a single setting, or `undefined` if not set. */
export function getSetting(key: string): string | undefined {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as SettingRow | undefined;
  return row?.value;
}

/** Upsert a setting. Updates `updated_at` automatically. */
export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                       updated_at = CURRENT_TIMESTAMP`,
  ).run(key, value);
}

// ── Typed convenience wrappers ─────────────────────────────────────────────

/** List of watched GitHub repos, stored as a JSON array of "owner/name" strings. */
export function getWatchedRepos(): string[] {
  const raw = getSetting("watched_repos");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r) => typeof r === "string") : [];
  } catch {
    return [];
  }
}

export function setWatchedRepos(repos: string[]): void {
  setSetting("watched_repos", JSON.stringify(repos));
}

/** Cron expression for the Monday-9am scheduler. Default per the original spec. */
const DEFAULT_SCHEDULE_CRON = "0 9 * * 1";

export function getScheduleCron(): string {
  return getSetting("schedule_cron") ?? DEFAULT_SCHEDULE_CRON;
}

export function setScheduleCron(cron: string): void {
  setSetting("schedule_cron", cron);
}

/** Banned words baked into the Claude prompt. Stored as one word/phrase per line. */
export function getBannedWords(): string[] {
  const raw = getSetting("banned_words");
  if (!raw) return [];
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function setBannedWords(words: string[]): void {
  setSetting("banned_words", words.join("\n"));
}

/** Free-form style notes baked into the prompt. */
export function getStyleNotes(): string {
  return getSetting("style_notes") ?? "";
}

export function setStyleNotes(notes: string): void {
  setSetting("style_notes", notes);
}

/**
 * Last scheduled-run timestamp (ISO 8601, UTC). Set by the scheduler after
 * each successful run. Used by the header to show "Last run: 3 days ago".
 * Returns null if the scheduler has never fired yet on this machine.
 */
export function getLastRunAt(): string | null {
  return getSetting("last_run_at") ?? null;
}

export function setLastRunAt(iso: string): void {
  setSetting("last_run_at", iso);
}
