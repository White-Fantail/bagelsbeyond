import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";
import { retryFailedSyncs, processPendingSyncJobs } from "@/lib/services/bagel-availability-service";

export const dynamic = "force-dynamic";

const schema = z.object({ bagelTypeId: z.string().optional() });

export async function POST(req: NextRequest) {
  const auth = await apiRequireStaffOrAdmin();
  if (isNextResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = schema.safeParse(body);

  try {
    await retryFailedSyncs(parsed.success ? parsed.data.bagelTypeId : undefined);
    void processPendingSyncJobs(10);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/admin/bagel-availability/retry]", err);
    return NextResponse.json({ message: "Retry failed" }, { status: 500 });
  }
}
