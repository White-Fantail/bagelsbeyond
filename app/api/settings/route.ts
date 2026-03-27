import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settingsSchema } from "@/lib/validations";

export async function GET() {
  try {
    let settings = await prisma.appSetting.findFirst();
    if (!settings) {
      settings = await prisma.appSetting.create({
        data: {},
      });
    }
    return NextResponse.json(settings);
  } catch (_error) {
    return NextResponse.json({ message: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let settings = await prisma.appSetting.findFirst();
    if (!settings) {
      settings = await prisma.appSetting.create({ data: parsed.data });
    } else {
      settings = await prisma.appSetting.update({
        where: { id: settings.id },
        data: parsed.data,
      });
    }

    return NextResponse.json(settings);
  } catch (_error) {
    return NextResponse.json({ message: "Save failed" }, { status: 500 });
  }
}
