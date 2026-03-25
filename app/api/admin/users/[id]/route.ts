import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { z } from "zod";

const patchSchema = z
  .object({
    role: z.enum([Role.ADMIN, Role.STAFF, Role.CUSTOMER]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.isActive !== undefined, {
    message: "role 또는 isActive 중 하나는 반드시 제공해야 합니다",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;
  const adminSession = authResult;

  const { id: targetId } = await params;

  // Validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { role: newRole, isActive: newIsActive } = parsed.data;

  // Find target user
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다" }, { status: 404 });
  }

  // ── Self-protection rules ──────────────────────────────────────────────────

  const isSelf = adminSession.userId === targetId;

  if (isSelf && newIsActive === false) {
    return NextResponse.json(
      { message: "자기 자신을 비활성화할 수 없습니다" },
      { status: 422 }
    );
  }

  if (isSelf && newRole !== undefined && newRole !== Role.ADMIN) {
    return NextResponse.json(
      { message: "자기 자신의 권한을 ADMIN 아래로 낮출 수 없습니다" },
      { status: 422 }
    );
  }

  // ── Last ADMIN protection ──────────────────────────────────────────────────

  if (target.role === Role.ADMIN) {
    const activeAdminCount = await prisma.user.count({
      where: { role: Role.ADMIN, isActive: true },
    });

    // Deactivating the last active ADMIN
    if (newIsActive === false && activeAdminCount <= 1) {
      return NextResponse.json(
        { message: "마지막 활성 관리자(ADMIN)는 비활성화할 수 없습니다" },
        { status: 422 }
      );
    }

    // Demoting the last ADMIN to a non-ADMIN role
    if (newRole !== undefined && newRole !== Role.ADMIN) {
      const totalAdminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (totalAdminCount <= 1) {
        return NextResponse.json(
          { message: "마지막 관리자(ADMIN)의 권한을 낮출 수 없습니다" },
          { status: 422 }
        );
      }
    }
  }

  // ── Apply changes & log ────────────────────────────────────────────────────

  try {
    const updateData: { role?: Role; isActive?: boolean } = {};
    if (newRole !== undefined) updateData.role = newRole;
    if (newIsActive !== undefined) updateData.isActive = newIsActive;

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Write audit log entries
    const logEntries: {
      adminUserId: string;
      targetUserId: string;
      actionType: string;
      previousValue: string;
      newValue: string;
    }[] = [];

    if (newRole !== undefined && newRole !== target.role) {
      logEntries.push({
        adminUserId: adminSession.userId,
        targetUserId: targetId,
        actionType: "CHANGE_ROLE",
        previousValue: target.role,
        newValue: newRole,
      });
    }

    if (newIsActive !== undefined && newIsActive !== target.isActive) {
      logEntries.push({
        adminUserId: adminSession.userId,
        targetUserId: targetId,
        actionType: newIsActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
        previousValue: String(target.isActive),
        newValue: String(newIsActive),
      });
    }

    if (logEntries.length > 0) {
      await prisma.adminActionLog.createMany({ data: logEntries });
    }

    return NextResponse.json({ user: updated });
  } catch (_error) {
    return NextResponse.json(
      { message: "사용자 정보 업데이트에 실패했습니다" },
      { status: 500 }
    );
  }
}
