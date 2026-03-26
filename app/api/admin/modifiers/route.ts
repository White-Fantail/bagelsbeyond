import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export async function GET(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
  const groupId = req.nextUrl.searchParams.get("groupId") ?? "";
  const sourceFilter = req.nextUrl.searchParams.get("source") ?? "ALL";
  const tracksFilter = req.nextUrl.searchParams.get("tracksInventory") ?? "ALL";
  const activeFilter = req.nextUrl.searchParams.get("isActive") ?? "ALL";

  const where: Record<string, unknown> = {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (groupId) {
    where.optionGroupId = groupId;
  }
  if (activeFilter === "ACTIVE") where.isActive = true;
  else if (activeFilter === "INACTIVE") where.isActive = false;

  if (tracksFilter === "YES") where.tracksInventory = true;
  else if (tracksFilter === "NO") where.tracksInventory = false;

  if (sourceFilter === "LOYVERSE") {
    where.externalOptionMappings = { some: { source: IntegrationSource.LOYVERSE } };
  } else if (sourceFilter === "INTERNAL") {
    where.externalOptionMappings = { none: { source: IntegrationSource.LOYVERSE } };
  }

  try {
    const options = await prisma.productOption.findMany({
      where,
      orderBy: [{ optionGroupId: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        priceDelta: true,
        isActive: true,
        sortOrder: true,
        sku: true,
        tracksInventory: true,
        optionGroupId: true,
        createdAt: true,
        updatedAt: true,
        optionGroup: {
          select: {
            id: true,
            name: true,
            product: { select: { id: true, name: true } },
          },
        },
        externalOptionMappings: {
          where: { source: IntegrationSource.LOYVERSE },
          select: {
            id: true,
            externalOptionId: true,
            externalName: true,
            externalGroupId: true,
            externalGroupName: true,
            lastSyncedAt: true,
          },
        },
        _count: {
          select: { dailyOptionInventory: true },
        },
      },
    });

    return NextResponse.json({ options });
  } catch (_error) {
    return NextResponse.json(
      { message: "Modifier 목록을 불러오는데 실패했습니다" },
      { status: 500 }
    );
  }
}
