// Stage 9b.4 — weekly generation triggered by Vercel Cron.
//
// Schedule lives in vercel.json: "0 8 * * 1,4" (Mon + Thu 08:00 UTC = 09:00
// UK during BST, 08:00 UK during GMT). Vercel Cron schedules are UTC-only
// and don't accept a timezone, so we pick one side of the DST trade and
// document it. The DB also stores a `schedule_cron` setting that the
// AppHeader uses to render "Next run: in X" — that one IS timezone-aware
// (cron-parser with tz: "Europe/London"), so the displayed countdown matches
// local time year-round even though the actual cron fires at 08:00 UTC.
//
// Auth model: Vercel automatically sets `Authorization: Bearer ${CRON_SECRET}`
// on the outbound request when the CRON_SECRET env var is set in the project.
// We reject anything else with 401. Without this gate the endpoint is a
// public unauthenticated trigger for a paid Claude call.
//
// Runtime: Node, because Anthropic SDK + Octokit + postgres.js all need Node.
// maxDuration: 60s — the Vercel Hobby-tier cap. Two-phase generation in
// src/lib/claude.ts (identifyMoments + parallel draftMoment) keeps the
// wall-clock budget under 60s even on a cold start: ~15s identify + ~15s
// parallel drafts + DB writes + cold-start overhead = ~35-45s typical.
// Self-hosters on Vercel Hobby (free tier) can run this without upgrading.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { generateDrafts } from "@/lib/claude";
import { setLastRunAt } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;
// Cron triggers should always run fresh — never cache the response.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Fail closed: missing env var is a misconfiguration, not licence to skip
    // auth. 500 (not 401) so it surfaces in the Vercel logs as a server bug.
    console.error("[cron/generate] CRON_SECRET is not set on the server.");
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: CRON_SECRET not set." },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    // Generic 401. Don't echo what was expected vs received — that would
    // turn this into an oracle for guessing the secret.
    return NextResponse.json(
      { ok: false, error: "Unauthorised." },
      { status: 401 },
    );
  }

  const triggeredAt = new Date().toISOString();

  try {
    const result = await generateDrafts();
    // Treat cron-triggered runs and dashboard-triggered runs the same: both
    // bump `last_run_at` so the AppHeader's "Last run" label is meaningful
    // regardless of source. Mirrors generateAllDraftsAction() in
    // src/app/dashboard-actions.ts.
    await setLastRunAt(triggeredAt);
    // If a user happens to open the dashboard right after a cron run, this
    // ensures they see the fresh moments without a manual refresh.
    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      triggeredAt,
      generationId: result.generationId,
      momentCount: result.momentCount,
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
        cacheRead: result.cacheReadTokens,
        cacheCreation: result.cacheCreationTokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Full stack only goes to the server logs, never the response body.
    console.error("[cron/generate] generation failed:", err);
    return NextResponse.json(
      { ok: false, triggeredAt, error: message },
      { status: 500 },
    );
  }
}
