"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireSuperAdmin } from "@/lib/auth/session";
import { getFixedSuperAdminEmail, isFixedSuperAdminEmail } from "@/lib/auth/super-admin";
import { insertAdminAuditLog } from "@/lib/admin/audit";

function revalidateAdminSurfaces() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/workspaces");
  revalidatePath("/admin/access-requests");
  revalidatePath("/admin/analytics");
  revalidatePath("/settings");
  revalidatePath("/settings/access-requests");
}

export async function setAdminUserActiveStateAction(input: { userId: string; nextActive: boolean }) {
  const actor = await getCurrentUser();
  await requireSuperAdmin();

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, organization_id: true, is_active: true },
  });

  if (!target) {
    throw new Error("User not found.");
  }

  if (isFixedSuperAdminEmail(target.email) && !input.nextActive) {
    throw new Error(`The protected super admin account ${getFixedSuperAdminEmail()} cannot be deactivated.`);
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { is_active: input.nextActive, updated_at: new Date() },
  });

  await insertAdminAuditLog({
    actorUserId: actor?.id ?? null,
    targetUserId: target.id,
    organizationId: target.organization_id,
    action: input.nextActive ? "admin.user.activated" : "admin.user.deactivated",
    entityType: "profile",
    entityId: target.id,
    metadata: {
      email: target.email,
      nextActive: input.nextActive,
    },
  });

  revalidateAdminSurfaces();
  revalidatePath("/team");
}

export async function setAdminUserSuperAdminStateAction(input: { userId: string; nextSuperAdmin: boolean }) {
  const actor = await getCurrentUser();
  await requireSuperAdmin();

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, organization_id: true, is_super_admin: true },
  });

  if (!target) {
    throw new Error("User not found.");
  }

  if (isFixedSuperAdminEmail(target.email) && !input.nextSuperAdmin) {
    throw new Error(`The fixed super admin account ${getFixedSuperAdminEmail()} cannot be demoted.`);
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { is_super_admin: input.nextSuperAdmin, updated_at: new Date() },
  });

  await insertAdminAuditLog({
    actorUserId: actor?.id ?? null,
    targetUserId: target.id,
    organizationId: target.organization_id,
    action: input.nextSuperAdmin ? "admin.user.promoted_super_admin" : "admin.user.demoted_super_admin",
    entityType: "profile",
    entityId: target.id,
    metadata: {
      email: target.email,
      nextSuperAdmin: input.nextSuperAdmin,
    },
  });

  revalidateAdminSurfaces();
}

export async function transferWorkspaceOwnerAction(input: { workspaceId: string; nextOwnerUserId: string }) {
  const actor = await getCurrentUser();
  await requireSuperAdmin();

  const workspace = await prisma.organization.findUnique({
    where: { id: input.workspaceId },
    select: { id: true, name: true, owner_user_id: true },
  });

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const nextOwner = await prisma.user.findUnique({
    where: { id: input.nextOwnerUserId },
    select: { id: true, email: true, name: true, organization_id: true },
  });

  if (!nextOwner || nextOwner.organization_id !== input.workspaceId) {
    throw new Error("The new owner must belong to this workspace.");
  }

  const adminRole = await prisma.role.findFirst({
    where: {
      organization_id: input.workspaceId,
      slug: "organization-admin",
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: input.workspaceId },
      data: { owner_user_id: nextOwner.id, updated_at: new Date() },
    });

    if (adminRole) {
      await tx.userRole.upsert({
        where: {
          organization_id_user_id_role_id: {
            organization_id: input.workspaceId,
            user_id: nextOwner.id,
            role_id: adminRole.id,
          },
        },
        update: {},
        create: {
          organization_id: input.workspaceId,
          user_id: nextOwner.id,
          role_id: adminRole.id,
          assigned_by: actor?.id ?? null,
        },
      });
    }
  });

  await insertAdminAuditLog({
    actorUserId: actor?.id ?? null,
    targetUserId: nextOwner.id,
    organizationId: input.workspaceId,
    action: "admin.workspace.owner_transferred",
    entityType: "organization",
    entityId: input.workspaceId,
    metadata: {
      workspaceName: workspace.name,
      previousOwnerUserId: workspace.owner_user_id,
      nextOwnerUserId: nextOwner.id,
      nextOwnerEmail: nextOwner.email,
    },
  });

  revalidateAdminSurfaces();
  revalidatePath("/settings/workspaces");
}
