import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";
import { restoreLastChange, executeSyncJob } from "@/lib/services/bagel-availability-service";

export const dynamic = "force-dynamic";

const schema = z.object({ bagelTypeId: z.string() });

export async function POST(req: NextRequest) {
  const auth = await apiRequireStaffOrAdmin();
  if (isNextResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "bagelTypeId required" }, { status: 400 });
  }

  try {
    const result = await restoreLastChange({
      bagelTypeId: parsed.data.bagelTypeId,
      source: "manual",
      userId: auth.userId,
    });

    if (!result.success) {
      return NextResponse.json({ message: result.error ?? "Restore failed" }, { status: 500 });
    }

    void Promise.all(result.enqueuedJobs.map((id) => executeSyncJob(id)));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/admin/bagel-availability/restore]", err);
    return NextResponse.json({ message: "Restore failed" }, { status: 500 });
  }
}
