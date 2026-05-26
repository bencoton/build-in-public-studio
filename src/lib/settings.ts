import sql from "./db";

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

/** Cron expression for the Monday-9am scheduler. Default per the spec. */
const DEFAULT_SCHEDULE_CRON = "0 9 * * 1";

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

/** Last successful generation timestamp (ISO 8601). Null if never run. */
export async function getLastRunAt(): Promise<string | null> {
  return (await getSetting("last_run_at")) ?? null;
}

export async function setLastRunAt(iso: string): Promise<void> {
  await setSetting("last_run_at", iso);
}
