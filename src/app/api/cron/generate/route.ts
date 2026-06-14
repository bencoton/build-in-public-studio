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
// Architecture: per-repo sync + generation, same as the dashboard button.
// Each repo is processed in sequence: sync from GitHub, then generateDrafts()
// filtered to that repo. This keeps each round-trip well under 60s.
// The cron endpoint itself has a longer effective budget because it's a route
// handler (not a server action), but we keep the pattern identical to the
// dashboard so the two paths stay in sync.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { generateDrafts } from "@/lib/claude";
import { syncOneRepo } from "@/lib/github-sync";
import { getWatchedRepos, setLastRunAt } from "@/lib/settings";

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
    return NextResponse.json(
      { ok: false, error: "Unauthorised." },
      { status: 401 },
    );
  }

  const triggeredAt = new Date().toISOString();
  const repos = await getWatchedRepos();

  if (repos.length === 0) {
    return NextResponse.json({
      ok: true,
      triggeredAt,
      message: "No watched repos configured — nothing to generate.",
      repos: [],
    });
  }

  const repoResults = [];
  let totalMoments = 0;

  for (const repo of repos) {
    // Sync first — non-fatal if it fails.
    try {
      const syncResult = await syncOneRepo(repo);
      if (!syncResult.ok) {
        console.warn(`[cron/generate] Sync failed for ${repo}:`, syncResult.error);
      }
    } catch (syncErr) {
      console.warn(`[cron/generate] Sync threw for ${repo}:`, syncErr);
    }

    // Generate for this repo.
    try {
      const result = await generateDrafts({ repoFilter: repo });
      totalMoments += result.momentCount;
      repoResults.push({ repo, ok: true, momentCount: result.momentCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[cron/generate] Generation failed for ${repo}:`, err);
      repoResults.push({ repo, ok: false, error: message });
    }
  }

  await setLastRunAt(triggeredAt);
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    triggeredAt,
    totalMoments,
    repos: repoResults,
  });
}
