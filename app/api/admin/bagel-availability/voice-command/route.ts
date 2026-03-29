import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";
import { toggleBagelAvailability, executeSyncJob } from "@/lib/services/bagel-availability-service";
import { parseVoiceCommandAsync } from "@/lib/services/voice-command-parser";

export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().min(1).max(200),
  confirmed: z.boolean().default(false),
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const { text, confirmed } = parsed.data;

  const parseResult = await parseVoiceCommandAsync(text);
  if (!parseResult) {
    return NextResponse.json({
      parsed: false,
      message: "Could not understand command. Try: 'sesame off', 'plain on', '세사미 꺼'",
      text,
    });
  }

  // Return preview for user confirmation before executing
  if (!confirmed) {
    return NextResponse.json({
      parsed: true,
      preview: parseResult.preview,
      command: parseResult,
      confirmed: false,
    });
  }

  try {
    const result = await toggleBagelAvailability({
      bagelTypeId: parseResult.bagelTypeId,
      isAvailable: parseResult.isAvailable,
      source: "voice",
      userId: auth.userId,
      note: `Voice: "${text}"`,
    });

    if (!result.success) {
      return NextResponse.json({ message: result.error ?? "Toggle failed" }, { status: 500 });
    }

    void Promise.all(result.enqueuedJobs.map((id) => executeSyncJob(id)));

    return NextResponse.json({
      parsed: true,
      confirmed: true,
      result,
      preview: parseResult.preview,
    });
  } catch (err) {
    console.error("[POST /api/admin/bagel-availability/voice-command]", err);
    return NextResponse.json({ message: "Voice command execution failed" }, { status: 500 });
  }
}
