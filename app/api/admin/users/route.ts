import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const roleFilter = searchParams.get("role") ?? "ALL";
  const activeFilter = searchParams.get("isActive") ?? "ALL";
  const sort = searchParams.get("sort") ?? "createdAt_desc";

  try {
    const searchWhere = search
      ? { OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ] }
      : {};

    const roleWhere =
      roleFilter !== "ALL" && Object.values(Role).includes(roleFilter as Role)
        ? { role: roleFilter as Role }
        : {};

    const activeWhere =
      activeFilter === "ACTIVE"
        ? { isActive: true }
        : activeFilter === "INACTIVE"
        ? { isActive: false }
        : {};

    const where = { ...searchWhere, ...roleWhere, ...activeWhere };

    type OrderBy = { createdAt: "asc" | "desc" } | { email: "asc" | "desc" } | { name: "asc" | "desc" };
    const orderByMap: Record<string, OrderBy> = {
      email_asc: { email: "asc" },
      email_desc: { email: "desc" },
      name_asc: { name: "asc" },
      createdAt_asc: { createdAt: "asc" },
      createdAt_desc: { createdAt: "desc" },
    };
    const orderBy: OrderBy = orderByMap[sort] ?? { createdAt: "desc" };

    const [users, total, adminCount, staffCount, customerCount, inactiveCount] =
      await Promise.all([
        prisma.user.findMany({
          where,
          orderBy,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.user.count(),
        prisma.user.count({ where: { role: Role.ADMIN } }),
        prisma.user.count({ where: { role: Role.STAFF } }),
        prisma.user.count({ where: { role: Role.CUSTOMER } }),
        prisma.user.count({ where: { isActive: false } }),
      ]);

    return NextResponse.json({
      users,
      summary: {
        total,
        adminCount,
        staffCount,
        customerCount,
        inactiveCount,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { message: "사용자 목록을 불러오는데 실패했습니다" },
      { status: 500 }
    );
  }
}
