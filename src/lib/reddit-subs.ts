/*
  Seed data + isomorphic slug helpers for the Reddit subreddit catalog.

  Subreddits used to be a hardcoded `SUBREDDIT_RULES` map keyed by a `SubSlug`
  union. They now live in a user-managed DB catalog (`subreddits` table, see
  src/lib/subreddits.ts). This file keeps two things:

    1. DEFAULT_SUBREDDITS — the four curated subs, seeded into the catalog on
       first run (idempotent, via seedDefaultSubreddits in subreddits.ts) so
       they keep their exact tone/rules. ⚠️ Curated snapshot — LAST REVIEWED
       2026-06. The pre-post checklist exists so the human eyeballs the live
       rules before pasting.

    2. Pure, client-safe helpers (no DB, no server imports) — submitUrlFor,
       normalizeSlug, isValidSlug, and the MAX_SUBS_PER_GENERATE cap — so both
       server code and client components can use them.

  Adding a sub no longer needs a code change: do it from Settings → Manage
  subreddits. This file is only the seed + helpers.
*/

/** Max subs selectable per project / per on-demand generate. Bounds cost + latency. */
export const MAX_SUBS_PER_GENERATE = 3;

/** New-post page for a sub. Derived from the slug, never stored (avoids drift). */
export function submitUrlFor(slug: string): string {
  return `https://www.reddit.com/r/${slug}/submit`;
}

/** Strip a leading "r/" (any case, optional leading slash) and trim. Returns
 *  the bare slug candidate so "r/WebDev" and "WebDev" normalise the same. */
export function normalizeSlug(raw: string): string {
  return raw.trim().replace(/^\/?r\//i, "").trim();
}

/** Reddit slug shape: letters, digits, underscore, 1–50 chars. Matches the
 *  drafts_subreddit_format_check added in migration 0005. */
export function isValidSlug(slug: string): boolean {
  return /^[A-Za-z0-9_]{1,50}$/.test(slug);
}

/** Shape of a curated seed entry. The DB catalog stores the same fields plus
 *  id/timestamps; rule fields are optional for user-added subs. */
export type DefaultSubreddit = {
  slug: string;
  displayName: string;
  toneNote: string;
  selfPromoRule: string;
  prePostChecklist: string[];
  flairHint?: string;
};

export const DEFAULT_SUBREDDITS: DefaultSubreddit[] = [
  {
    slug: "SaaS",
    displayName: "r/SaaS",
    toneNote:
      "Pragmatic founder-to-founder. Lead with a concrete lesson or number, not the product. The product can appear, but the post has to stand on its own as something a SaaS builder learns from.",
    selfPromoRule:
      "Self-promotion is tolerated when it's value-first — a useful story, lesson, or metric that happens to mention your product. Bare 'check out my app' link-drops get removed. Many weeks have a dedicated promo/feedback thread; prefer that for pure plugs.",
    prePostChecklist: [
      "The post teaches something even if the reader never clicks your link.",
      "No bare link-drop — the link (if any) sits inside a story, not as the whole post.",
      "Mentioned your product at most once, and not in the title.",
      "Checked whether this week has a self-promo/feedback megathread you should use instead.",
    ],
    flairHint:
      "Pick a flair that matches the post — e.g. 'Build In Public' or 'Self-Promotion' if the post links to your product.",
  },
  {
    slug: "indiehackers",
    displayName: "r/indiehackers",
    toneNote:
      "Transparent journey storytelling, first person. Real numbers, real setbacks, what you'd do differently. The 'I'm a beginner learning in public' angle is on-brand here — lean in, don't paper over it.",
    selfPromoRule:
      "Build-in-public journey posts are the point of this sub and are welcome. Pure ads are not. Transparency (including revenue/usage numbers and what went wrong) is rewarded; polished marketing copy is penalised.",
    prePostChecklist: [
      "Written first-person as a journey update, not a product pitch.",
      "Includes at least one real number and one real setback.",
      "Honest about uncertainty — anything shaky is flagged, not glossed over.",
      "Reads like a person reflecting, not like a landing page.",
    ],
    flairHint: "Use a flair like 'Sharing my story' / 'Milestone' if the sub offers one.",
  },
  {
    slug: "SideProject",
    displayName: "r/SideProject",
    toneNote:
      "Show, don't sell. Describe what you actually built and how it works. Screenshots, a demo link, or a concrete walkthrough beat any persuasion. Enthusiasm is fine; salesmanship is not.",
    selfPromoRule:
      "Sharing your own project is the entire purpose of the sub, so a project post is welcome — but it must show the thing (what it is, what it does, how you built it), not just sell it. Repeated reposts of the same project or thin link-drops get removed.",
    prePostChecklist: [
      "Shows what you built — a screenshot, demo link, or concrete walkthrough.",
      "Explains how it works or how you made it, not just what to buy.",
      "Not a repost of the same project you already shared recently.",
      "Title describes the project plainly, no hype words.",
    ],
    flairHint: "Tag with the most fitting flair (e.g. 'Web App', 'Show & Tell') if required.",
  },
  {
    slug: "microsaas",
    displayName: "r/microsaas",
    toneNote:
      "Concrete and numbers-friendly. This audience likes specifics — MRR, tech choices, time spent, what moved the needle. Small-scale honesty (low numbers, slow growth) is welcome, not embarrassing.",
    selfPromoRule:
      "Self-promotion is allowed when it carries substance — actual numbers, tech details, or lessons a fellow micro-SaaS builder can use. Vague hype or contentless link-drops get removed.",
    prePostChecklist: [
      "Includes specifics — numbers, tech stack, or time spent — not vague claims.",
      "Small/honest numbers are stated plainly rather than inflated.",
      "Any link sits inside a substantive post, not as the whole thing.",
      "One clear takeaway a micro-SaaS builder can act on.",
    ],
    flairHint: "Add a 'Self-Promotion' or 'Build in Public' flair if the post links to your product.",
  },
];
