import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "그룹명을 입력해주세요"),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";

  try {
    const groups = await prisma.productOptionGroup.findMany({
      where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        minSelect: true,
        maxSelect: true,
        isRequired: true,
        sortOrder: true,
        _count: { select: { options: true } },
      },
    });
    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json({ message: "모디파이어 그룹 목록을 불러오는데 실패했습니다" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const group = await prisma.productOptionGroup.create({
      data: parsed.data,
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "모디파이어 그룹 생성에 실패했습니다" }, { status: 500 });
  }
}
