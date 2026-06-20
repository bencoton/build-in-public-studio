/*
  Curated subreddit rules — the single source of truth for the four subs
  Build-in-Public Studio drafts for. This is CODE, reviewed in PRs, applying
  to all users. It is NOT scraped at runtime (deliberate non-goal in the spec):
  subs change their rules rarely, and a stale-rule risk is cheaper and safer
  than a crawler.

  ⚠️  Curated snapshot — LAST REVIEWED 2026-06.
  Reddit communities revise their self-promo policies occasionally. When the
  rules below drift from a sub's actual posted rules, update this file and bump
  the review date. Treat anything here as guidance for the human poster, not a
  guarantee — the prePostChecklist exists precisely so Ben eyeballs the live
  rules before pasting.

  Isomorphic: pure data + types, no server-only imports, safe to import from
  client components (the moment card indexes SUBREDDIT_RULES for submit URLs
  and checklists).
*/

export type SubSlug = "SaaS" | "indiehackers" | "SideProject" | "microsaas";

export interface SubredditRule {
  slug: SubSlug;
  /** Display form, e.g. "r/SaaS". */
  displayName: string;
  /** One line fed into the Claude prompt to steer the draft's voice per sub. */
  toneNote: string;
  /** Human-readable summary of the sub's self-promo policy. Shown in the UI. */
  selfPromoRule: string;
  /** Checklist the user reviews before copying, to avoid mod-filter trips. */
  prePostChecklist: string[];
  /** Optional flair guidance (we surface it as text; we don't auto-select flair). */
  flairHint?: string;
  /** New-post page for this sub. */
  submitUrl: string;
}

const submitUrl = (slug: SubSlug) => `https://www.reddit.com/r/${slug}/submit`;

export const SUBREDDIT_RULES: Record<SubSlug, SubredditRule> = {
  SaaS: {
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
    flairHint: "Pick a flair that matches the post — e.g. 'Build In Public' or 'Self-Promotion' if the post links to your product.",
    submitUrl: submitUrl("SaaS"),
  },
  indiehackers: {
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
    submitUrl: submitUrl("indiehackers"),
  },
  SideProject: {
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
    submitUrl: submitUrl("SideProject"),
  },
  microsaas: {
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
    submitUrl: submitUrl("microsaas"),
  },
};

/** Ordered list for UI (multi-select, etc.). */
export const SUB_SLUGS: SubSlug[] = [
  "SaaS",
  "indiehackers",
  "SideProject",
  "microsaas",
];

/** Type guard — narrows an arbitrary DB string to a known SubSlug. */
export function isSubSlug(value: unknown): value is SubSlug {
  return typeof value === "string" && value in SUBREDDIT_RULES;
}

/** Max subs selectable per moment in one generate action (spec open question D6). */
export const MAX_SUBS_PER_GENERATE = 3;
