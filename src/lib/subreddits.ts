import sql from "./db";
import { coerceStringArray } from "./json";
import { getSetting, setSetting } from "./settings";
import {
  DEFAULT_SUBREDDITS,
  normalizeSlug,
  isValidSlug,
  submitUrlFor,
} from "./reddit-subs";

// Re-export so server callers can pull the derived submit URL from the catalog
// module (per the spec), while client components import it from reddit-subs.
export { submitUrlFor };

/*
  User-managed subreddit catalog (migration 0005). Global — one row per sub the
  user can target, selected per-project via reddit.subs.<repo>. Only slug +
  display_name are required; the rule fields are optional (name-only adds) and
  generation falls back to a generic journey steer when they're blank.

  BIPS-L4: every row that crosses into a client component is spread into a
  plain object (or mapped to a SubredditView) so the RSC serializer accepts it.
*/

export type SubredditRow = {
  id: number;
  slug: string;
  display_name: string;
  tone_note: string | null;
  self_promo_rule: string | null;
  prepost_checklist: string[] | null;
  flair_hint: string | null;
  created_at: Date;
  updated_at: Date;
};

/** Client-safe, camelCase shape with the derived submit URL. What we pass as
 *  props into client components (moment card, settings sections). */
export type SubredditView = {
  slug: string;
  displayName: string;
  toneNote: string | null;
  selfPromoRule: string | null;
  prePostChecklist: string[] | null;
  flairHint: string | null;
  submitUrl: string;
};

/** Spread a raw DB row into a plain object AND coerce its jsonb array column
 *  (prepost_checklist arrives as a JSON string here — see BIPS-L7). */
function rowToSubreddit(r: SubredditRow): SubredditRow {
  return { ...r, prepost_checklist: coerceStringArray(r.prepost_checklist) };
}

export function toView(row: SubredditRow): SubredditView {
  return {
    slug: row.slug,
    displayName: row.display_name,
    toneNote: row.tone_note,
    selfPromoRule: row.self_promo_rule,
    prePostChecklist: row.prepost_checklist,
    flairHint: row.flair_hint,
    submitUrl: submitUrlFor(row.slug),
  };
}

const SELECT_COLS = sql`
  id, slug, display_name, tone_note, self_promo_rule,
  prepost_checklist, flair_hint, created_at, updated_at
`;

// ── Seeding ────────────────────────────────────────────────────────────────

/** Idempotent: insert the four curated subs, skipping any whose slug already
 *  exists. Safe to call repeatedly. */
export async function seedDefaultSubreddits(): Promise<void> {
  for (const s of DEFAULT_SUBREDDITS) {
    await sql`
      INSERT INTO subreddits
        (slug, display_name, tone_note, self_promo_rule, prepost_checklist, flair_hint)
      VALUES (
        ${s.slug}, ${s.displayName}, ${s.toneNote}, ${s.selfPromoRule},
        ${JSON.stringify(s.prePostChecklist)}::jsonb, ${s.flairHint ?? null}
      )
      ON CONFLICT (slug) DO NOTHING
    `;
  }
}

/** One-time guard via a settings flag, so deleting all subs later doesn't
 *  silently re-seed them. Cheap (one indexed read) on the common path. */
async function ensureSeeded(): Promise<void> {
  const flag = await getSetting("subreddits.seeded");
  if (flag === "1") return;
  await seedDefaultSubreddits();
  await setSetting("subreddits.seeded", "1");
}

// ── Reads ────────────────────────────────────────────────────────────────

/** The whole catalog, oldest-first (curated four lead). Seeds on first call. */
export async function getSubreddits(): Promise<SubredditRow[]> {
  await ensureSeeded();
  const rows = await sql<SubredditRow[]>`
    SELECT ${SELECT_COLS} FROM subreddits ORDER BY created_at ASC, id ASC
  `;
  return rows.map(rowToSubreddit);
}

/** Catalog mapped to client-safe views (plain objects + derived submit URL). */
export async function getSubredditViews(): Promise<SubredditView[]> {
  return (await getSubreddits()).map(toView);
}

/** One sub by exact slug, or null if it's not in the catalog (e.g. removed —
 *  generation then falls back to a generic steer). */
export async function getSubredditBySlug(
  slug: string,
): Promise<SubredditRow | null> {
  const rows = await sql<SubredditRow[]>`
    SELECT ${SELECT_COLS} FROM subreddits WHERE slug = ${slug} LIMIT 1
  `;
  return rows[0] ? rowToSubreddit(rows[0]) : null;
}

// ── Mutations ──────────────────────────────────────────────────────────────

export type CreateSubredditInput = {
  /** Subreddit name (the slug source). "r/" is stripped; validated + deduped. */
  name: string;
  toneNote?: string;
  selfPromoRule?: string;
  prePostChecklist?: string[];
  flairHint?: string;
};

export type UpdateSubredditPatch = {
  toneNote?: string;
  selfPromoRule?: string;
  prePostChecklist?: string[];
  flairHint?: string;
};

function blankToNull(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function cleanChecklist(items: string[] | undefined): string[] | null {
  if (!items) return null;
  const cleaned = items.map((i) => i.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
}

/** Add a sub. Only the name is required; rule fields optional. Slug is the
 *  normalised name; display_name is "r/<slug>". Rejects bad/duplicate slugs. */
export async function createSubreddit(
  input: CreateSubredditInput,
): Promise<SubredditRow> {
  const slug = normalizeSlug(input.name);
  if (!isValidSlug(slug)) {
    throw new Error(
      `Invalid subreddit name "${input.name}". Use letters, numbers, or underscores only (no "r/", no spaces).`,
    );
  }
  // Case-insensitive dedupe (the UNIQUE index is case-sensitive).
  const existing = await sql`
    SELECT 1 FROM subreddits WHERE lower(slug) = lower(${slug}) LIMIT 1
  `;
  if (existing.length > 0) {
    throw new Error(`r/${slug} is already in the catalog.`);
  }

  const checklist = cleanChecklist(input.prePostChecklist);
  const rows = await sql<SubredditRow[]>`
    INSERT INTO subreddits
      (slug, display_name, tone_note, self_promo_rule, prepost_checklist, flair_hint)
    VALUES (
      ${slug}, ${`r/${slug}`}, ${blankToNull(input.toneNote)},
      ${blankToNull(input.selfPromoRule)},
      ${checklist === null ? null : JSON.stringify(checklist)}::jsonb,
      ${blankToNull(input.flairHint)}
    )
    RETURNING ${SELECT_COLS}
  `;
  return rowToSubreddit(rows[0]);
}

/** Edit a sub's optional rule fields (slug/display_name are immutable — the
 *  slug is the key stored on historical drafts). */
export async function updateSubreddit(
  slug: string,
  patch: UpdateSubredditPatch,
): Promise<void> {
  const checklist = cleanChecklist(patch.prePostChecklist);
  await sql`
    UPDATE subreddits SET
      tone_note         = ${blankToNull(patch.toneNote)},
      self_promo_rule   = ${blankToNull(patch.selfPromoRule)},
      prepost_checklist = ${checklist === null ? null : JSON.stringify(checklist)}::jsonb,
      flair_hint        = ${blankToNull(patch.flairHint)},
      updated_at        = now()
    WHERE slug = ${slug}
  `;
}

/** Remove a sub from the catalog. Historical drafts keep their stored slug +
 *  title (no FK on purpose). Dropping it from project selections is the
 *  caller's job (removeSubFromAllProjects). */
export async function deleteSubreddit(slug: string): Promise<void> {
  await sql`DELETE FROM subreddits WHERE slug = ${slug}`;
}
