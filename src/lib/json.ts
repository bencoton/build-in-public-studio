/**
 * Coerce a jsonb-array column value to a real `string[]` (or null).
 *
 * ⚠️ Why this exists (CLAUDE.md BIPS-L7): with this app's Neon pooled
 * connection (`postgres.js`, `prepare: false`), jsonb columns deserialize to a
 * JSON *string*, NOT a parsed array — the declared TS type is a compile-time
 * fiction at the DB boundary. So a jsonb array arrives as e.g. '["a","b"]'.
 * Passing it through makes `.join`/`.map`/`.filter` misbehave, and an
 * `Array.isArray`-only guard silently yields `[]` (hiding the bug, dropping the
 * data). Parse + guard at the read choke point so every consumer downstream
 * gets a genuine array.
 *
 * Canonical fix for ALL jsonb array columns in this project — used by the
 * subreddit catalog (`prepost_checklist`) and moments (`source_ref`).
 */
export function coerceStringArray(value: unknown): string[] | null {
  let arr: unknown = value;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const out = arr.filter((x): x is string => typeof x === "string");
  return out.length > 0 ? out : null;
}
