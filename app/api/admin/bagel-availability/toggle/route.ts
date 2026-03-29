import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  toggleBagelAvailability,
  toggleAllBagelAvailability,
  executeSyncJob,
} from "@/lib/services/bagel-availability-service";

export const dynamic = "force-dynamic";

const toggleSchema = z.object({
  bagelTypeId: z.string().optional(),
  isAvailable: z.boolean(),
  all: z.boolean().optional().default(false),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await apiRequireStaffOrAdmin();
  if (isNextResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { bagelTypeId, isAvailable, all, note } = parsed.data;

  try {
    if (all) {
      const results = await toggleAllBagelAvailability({
        isAvailable,
        source: "manual",
        userId: auth.userId,
      });
      void Promise.all(
        results.flatMap((r) => r.enqueuedJobs.map((jobId) => executeSyncJob(jobId)))
      );
      return NextResponse.json({ success: true, results });
    }

    if (!bagelTypeId) {
      return NextResponse.json({ message: "bagelTypeId required when all=false" }, { status: 400 });
    }

    const result = await toggleBagelAvailability({
      bagelTypeId,
      isAvailable,
      source: "manual",
      userId: auth.userId,
      note,
    });

    if (!result.success) {
      return NextResponse.json({ message: result.error ?? "Toggle failed" }, { status: 500 });
    }

    // Fire off sync jobs asynchronously (don't block the response)
    void Promise.all(result.enqueuedJobs.map((jobId) => executeSyncJob(jobId)));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/admin/bagel-availability/toggle]", err);
    return NextResponse.json({ message: "Toggle failed" }, { status: 500 });
  }
}
