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
    message: "At least one of role or isActive must be provided",
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
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { role: newRole, isActive: newIsActive } = parsed.data;

  // Find target user
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  // ── Self-protection rules ──────────────────────────────────────────────────

  const isSelf = adminSession.userId === targetId;

  if (isSelf && newIsActive === false) {
    return NextResponse.json(
      { message: "You cannot deactivate yourself" },
      { status: 422 }
    );
  }

  if (isSelf && newRole !== undefined && newRole !== Role.ADMIN) {
    return NextResponse.json(
      { message: "You cannot lower your own role below ADMIN" },
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
        { message: "The last active Admin cannot be deactivated" },
        { status: 422 }
      );
    }

    // Demoting the last ADMIN to a non-ADMIN role
    if (newRole !== undefined && newRole !== Role.ADMIN) {
      const totalAdminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (totalAdminCount <= 1) {
        return NextResponse.json(
          { message: "Cannot lower the role of the last Admin" },
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
      { message: "Failed to update user info" },
      { status: 500 }
    );
  }
}
