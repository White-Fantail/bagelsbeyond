/**
 * POST /api/internal/jobs/daily-order-push
 *
 * This endpoint has been deprecated. The daily order push feature has been
 * removed as part of the catalog architecture rebuild.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "daily-order-push has been removed in this version" },
    { status: 410 }
  );
}
