// Diagnostic endpoint — tests DB connectivity and returns the raw error if
// it fails. DELETE THIS FILE once the connection issue is resolved.

import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await sql<Array<{ now: Date }>>`SELECT now()`;
    return NextResponse.json({
      ok: true,
      db: "connected",
      serverTime: result[0]?.now,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[health] DB connection failed:", err);
    return NextResponse.json(
      { ok: false, db: "failed", error: message, stack },
      { status: 500 },
    );
  }
}
