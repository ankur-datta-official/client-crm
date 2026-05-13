"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getCurrentProfile,
  getCurrentUser,
  hasPermission,
  requireAuth,
  requireOrganization,
  requirePermission,
} from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { createWorkspaceNotification } from "@/lib/notifications/notifications";
import { prisma } from "@/lib/prisma";
import { applyScoringEvent, buildScoreIdempotencyKey } from "@/lib/scoring/service";
import { isFixedSuperAdminEmail } from "@/lib/auth/super-admin";
import { sendTeamInviteEmail } from "./invite-email";
import { getPermissions, getRoleById, getRoles } from "./team-queries";

type InviteTeamMemberInput = {
  email: string;
  roleId: string;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
};

type RoleInput = {
  name: string;
  description?: string;
};

const inviteTeamMemberSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Please enter a valid email address."),
  roleId: z.string().trim().min(1, "Role is required."),
  fullName: z.string().trim().optional(),
  jobTitle: z.string().trim().optional(),
  department: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

const roleInputSchema = z.object({
  name: z.string().trim().min(1, "Role name is required."),
  description: z.string().trim().optional(),
});

async function logActivity(
  organizationId: string,
  action: string,
  entityType: string | null,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const user = await getCurrentUser();
  const metadataJson = JSON.stringify(metadata);

  await prisma.$executeRaw`
    insert into public.activity_logs (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${user?.id ?? null}::uuid,
      ${action},
      ${entityType},
      ${entityId}::uuid,
      ${metadataJson}::jsonb
    )
  `;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getRoleOrThrow(roleId: string, organizationId: string) {
  const role = await getRoleById(roleId);

  if (!role || role.organization_id !== organizationId) {
    throw new Error("Role not found.");
  }

  return role;
}

async function getDefaultRoleId() {
  const roles = await getRoles();
  return roles.find((role) => role.slug === "viewer")?.id ?? roles[0]?.id ?? null;
}

async function ensureRoleManagementAccess() {
  const allowed = await hasPermission("settings.manage");

  if (!allowed) {
    throw new Error("You do not have permission to manage roles.");
  }
}

export async function inviteTeamMember(input: InviteTeamMemberInput) {
  await requirePermission("team.invite");
  const organization = await requireOrganization();
  const user = await requireAuth();
  const parsedInputResult = inviteTeamMemberSchema.safeParse(input);

  if (!parsedInputResult.success) {
    throw new Error(parsedInputResult.error.errors[0]?.message ?? "Please check the invite form and try again.");
  }

  const parsedInput = parsedInputResult.data;
  const email = normalizeEmail(parsedInput.email);
  const role = await getRoleOrThrow(parsedInput.roleId, organization.id);

  const [existingInvitation, existingProfile] = await Promise.all([
    prisma.teamInvitation.findFirst({
      where: {
        organization_id: organization.id,
        email,
        status: "pending",
      },
      select: {
        id: true,
      },
    }),
    prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        organization_id: true,
      },
    }),
  ]);

  if (existingInvitation) {
    throw new Error("A pending invitation already exists for this email.");
  }

  if (existingProfile?.organization_id === organization.id) {
    throw new Error("This user is already a member of your organization.");
  }

  if (existingProfile?.organization_id && existingProfile.organization_id !== organization.id) {
    throw new Error("This user already belongs to another organization.");
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = crypto.randomUUID();
  let invitationRecord: { id: string; token: string };

  try {
    invitationRecord = await prisma.teamInvitation.create({
      data: {
        organization_id: organization.id,
        email,
        role_id: parsedInput.roleId,
        invited_by: user.id,
        token,
        full_name: parsedInput.fullName || null,
        job_title: parsedInput.jobTitle || null,
        department: parsedInput.department || null,
        phone: parsedInput.phone || null,
        expires_at: expiresAt,
        updated_at: new Date(),
      },
      select: {
        id: true,
        token: true,
      },
    });
  } catch (error) {
    logServerError("team.invite", error, { organizationId: organization.id, email });
    throw new Error(getSafeErrorMessage(error, "Unable to create the invitation right now."));
  }

  let emailDelivery: Awaited<ReturnType<typeof sendTeamInviteEmail>>;

  try {
    emailDelivery = await sendTeamInviteEmail({
      email,
      token: invitationRecord.token,
      fullName: parsedInput.fullName || null,
      organizationName: organization.name,
      roleName: role.name,
      expiresAt,
    });
  } catch (deliveryError) {
    logServerError("team.invite.email", deliveryError, { organizationId: organization.id, email });
    emailDelivery = {
      ok: false,
      reason: deliveryError instanceof Error ? deliveryError.message : "Email delivery could not be completed.",
    };
  }

  await logActivity(organization.id, "team.member.invited", "team_invitation", invitationRecord.id, {
    email,
    role_id: parsedInput.roleId,
    email_delivery_method: emailDelivery.ok ? emailDelivery.method : "manual_fallback",
  });

  await createWorkspaceNotification({
    userId: user.id,
    type: "team.invitation.created",
    title: "Invitation created",
    message: emailDelivery.ok
      ? `Invitation email sent to ${email}.`
      : `Invite created for ${email}, but email delivery needs manual fallback.`,
    link: "/team",
  });

  revalidatePath("/team");
  return {
    ...invitationRecord,
    emailDelivery,
  };
}

export async function cancelTeamInvitation(invitationId: string) {
  await requirePermission("team.invite");
  const organization = await requireOrganization();

  const invitation = await prisma.teamInvitation.findFirst({
    where: {
      id: invitationId,
      organization_id: organization.id,
    },
    select: {
      id: true,
      email: true,
      status: true,
    },
  });

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new Error("Only pending invitations can be cancelled.");
  }

  await prisma.teamInvitation.update({
    where: {
      id: invitationId,
    },
    data: {
      status: "cancelled",
      updated_at: new Date(),
    },
  });

  await logActivity(organization.id, "team.invitation.cancelled", "team_invitation", invitationId, {
    email: invitation.email,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function resendTeamInvitation(invitationId: string) {
  await requirePermission("team.invite");
  const organization = await requireOrganization();

  const invitation = await prisma.teamInvitation.findFirst({
    where: {
      id: invitationId,
      organization_id: organization.id,
    },
    select: {
      id: true,
      email: true,
      status: true,
      full_name: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new Error("Only pending invitations can be resent.");
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.teamInvitation.update({
    where: {
      id: invitationId,
    },
    data: {
      token,
      expires_at: expiresAt,
      updated_at: new Date(),
    },
  });

  let emailDelivery: Awaited<ReturnType<typeof sendTeamInviteEmail>>;

  try {
    emailDelivery = await sendTeamInviteEmail({
      email: invitation.email,
      token,
      fullName: invitation.full_name ?? null,
      organizationName: organization.name,
      roleName: invitation.role?.name ?? null,
      expiresAt,
    });
  } catch (deliveryError) {
    logServerError("team.invite.resend_email", deliveryError, { organizationId: organization.id, email: invitation.email });
    emailDelivery = {
      ok: false,
      reason: deliveryError instanceof Error ? deliveryError.message : "Email delivery could not be completed.",
    };
  }

  await logActivity(organization.id, "team.invitation.resent", "team_invitation", invitationId, {
    email: invitation.email,
    email_delivery_method: emailDelivery.ok ? emailDelivery.method : "manual_fallback",
  });

  revalidatePath("/team");
  return { success: true, token, emailDelivery };
}

export async function acceptTeamInvitation(token: string) {
  const user = await requireAuth();
  const profile = await getCurrentProfile();
  const invitationRecord = await prisma.teamInvitation.findUnique({
    where: {
      token,
    },
    select: {
      id: true,
      email: true,
      organization_id: true,
      role_id: true,
      invited_by: true,
      status: true,
      expires_at: true,
      full_name: true,
      job_title: true,
      department: true,
      phone: true,
    },
  });

  if (!invitationRecord || invitationRecord.status !== "pending" || new Date(invitationRecord.expires_at).getTime() <= Date.now()) {
    throw new Error("This invitation is invalid or has expired.");
  }

  if (!user.email || normalizeEmail(user.email) !== normalizeEmail(invitationRecord.email)) {
    throw new Error("Please sign in with the same email address that received this invitation.");
  }

  if (profile?.organization_id && profile.is_active) {
    throw new Error("This account already belongs to an active organization.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentUserProfile = await tx.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        organization_id: true,
        name: true,
        job_title: true,
        department: true,
        phone: true,
      },
    });

    if (!currentUserProfile) {
      throw new Error("Your profile could not be found.");
    }

    if (
      currentUserProfile.organization_id
      && currentUserProfile.organization_id !== invitationRecord.organization_id
    ) {
      throw new Error("This account already belongs to another organization.");
    }

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        organization_id: invitationRecord.organization_id,
        is_active: true,
        name: currentUserProfile.name ?? invitationRecord.full_name ?? undefined,
        job_title: currentUserProfile.job_title ?? invitationRecord.job_title ?? undefined,
        department: currentUserProfile.department ?? invitationRecord.department ?? undefined,
        phone: currentUserProfile.phone ?? invitationRecord.phone ?? undefined,
      },
    });

    await tx.userRole.deleteMany({
      where: {
        organization_id: invitationRecord.organization_id,
        user_id: user.id,
      },
    });

    await tx.userRole.create({
      data: {
        organization_id: invitationRecord.organization_id,
        user_id: user.id,
        role_id: invitationRecord.role_id,
        assigned_by: invitationRecord.invited_by,
      },
    });

    await tx.teamInvitation.update({
      where: {
        id: invitationRecord.id,
      },
      data: {
        status: "accepted",
        accepted_at: new Date(),
        updated_at: new Date(),
      },
    });

    return {
      organization_id: invitationRecord.organization_id,
      invitation_id: invitationRecord.id,
      role_id: invitationRecord.role_id,
      invited_by: invitationRecord.invited_by,
      invited_email: invitationRecord.email,
    };
  });

  await logActivity(result.organization_id as string, "team.invitation.accepted", "team_invitation", result.invitation_id as string, {
    accepted_user_id: user.id,
    role_id: result.role_id,
  });

  if (result.invited_by && result.invited_by !== user.id) {
    await applyScoringEvent({
      organizationId: result.organization_id as string,
      userId: result.invited_by,
      actionKey: "team_invite_accepted",
      sourceRecordId: result.invitation_id,
      sourceRecordType: "team_invitation",
      metadata: {
        accepted_user_id: user.id,
        invited_email: result.invited_email,
      },
      actorUserId: user.id,
      addToLeadScore: false,
      idempotencyKey: buildScoreIdempotencyKey(["team_invite_accepted", result.invitation_id]),
    });
  }

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return result as { organization_id: string; invitation_id: string; role_id: string };
}

export async function updateTeamMemberRole(userId: string, roleId: string) {
  await requirePermission("team.update_role");
  const organization = await requireOrganization();
  const user = await requireAuth();
  const role = await getRoleOrThrow(roleId, organization.id);

  if (userId === user.id) {
    throw new Error("You cannot change your own role.");
  }

  const targetProfile = await prisma.user.findFirst({
    where: {
      id: userId,
      organization_id: organization.id,
    },
    select: {
      id: true,
      email: true,
      organization_id: true,
      is_active: true,
      userRoles: {
        where: {
          organization_id: organization.id,
        },
        orderBy: {
          assigned_at: "desc",
        },
        take: 1,
        select: {
          role_id: true,
          role: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!targetProfile) {
    throw new Error("Team member not found.");
  }

  if (isFixedSuperAdminEmail(targetProfile.email)) {
    throw new Error("The protected super admin account cannot be reassigned.");
  }

  const currentRoleAssignment = targetProfile.userRoles[0] ?? null;
  const currentRoleSlug = currentRoleAssignment?.role.slug ?? null;

  if (currentRoleAssignment?.role_id === roleId) {
    return { success: true, unchanged: true };
  }

  if (targetProfile.id === organization.owner_user_id && role.slug !== "organization-admin") {
    throw new Error("The workspace owner must remain an Organization Admin.");
  }

  if (currentRoleSlug === "organization-admin" && role.slug !== "organization-admin") {
    const otherActiveAdminCount = await prisma.userRole.count({
      where: {
        organization_id: organization.id,
        user_id: {
          not: userId,
        },
        role: {
          slug: "organization-admin",
        },
        user: {
          is_active: true,
        },
      },
    });

    if (otherActiveAdminCount === 0) {
      throw new Error("At least one active Organization Admin must remain in this workspace.");
    }
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({
      where: {
        organization_id: organization.id,
        user_id: userId,
      },
    }),
    prisma.userRole.create({
      data: {
        organization_id: organization.id,
        user_id: userId,
        role_id: roleId,
        assigned_by: user.id,
      },
    }),
  ]);

  await logActivity(organization.id, "team.member.role_changed", "profile", userId, {
    email: targetProfile.email,
    previous_role_id: currentRoleAssignment?.role_id ?? null,
    previous_role_name: currentRoleAssignment?.role.name ?? null,
    role_id: roleId,
    role_name: role.name,
  });

  revalidatePath("/team");
  revalidatePath("/settings");
  return { success: true };
}

export async function updateTeamMemberManager(userId: string, managerUserId: string | null) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const user = await requireAuth();

  if (userId === user.id && managerUserId) {
    throw new Error("You cannot report to yourself.");
  }

  const targetProfile = await prisma.user.findFirst({
    where: {
      id: userId,
      organization_id: organization.id,
    },
    select: {
      id: true,
      email: true,
      organization_id: true,
    },
  });

  if (!targetProfile) {
    throw new Error("Team member not found.");
  }

  if (managerUserId) {
    const managerProfile = await prisma.user.findFirst({
      where: {
        id: managerUserId,
        organization_id: organization.id,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!managerProfile) {
      throw new Error("Selected senior team member was not found.");
    }
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      manager_user_id: managerUserId,
    },
  });

  await logActivity(organization.id, "team.member.manager_changed", "profile", userId, {
    email: targetProfile.email,
    manager_user_id: managerUserId,
    updated_by: user.id,
  });

  revalidatePath("/team");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: true };
}

export async function deactivateTeamMember(userId: string) {
  await requirePermission("team.deactivate");
  const organization = await requireOrganization();
  const user = await requireAuth();

  if (userId === user.id) {
    throw new Error("You cannot deactivate your own account.");
  }

  const targetProfile = await prisma.user.findFirst({
    where: {
      id: userId,
      organization_id: organization.id,
    },
    select: {
      id: true,
      email: true,
      organization_id: true,
      is_active: true,
    },
  });

  if (!targetProfile) {
    throw new Error("Team member not found.");
  }

  if (!targetProfile.is_active) {
    throw new Error("This team member is already inactive.");
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      is_active: false,
    },
  });

  await logActivity(organization.id, "team.member.deactivated", "profile", userId, {
    email: targetProfile.email,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function reactivateTeamMember(userId: string, roleId?: string) {
  await requirePermission("team.deactivate");
  const organization = await requireOrganization();
  const user = await requireAuth();

  const targetProfile = await prisma.user.findFirst({
    where: {
      id: userId,
      organization_id: organization.id,
    },
    select: {
      id: true,
      email: true,
      organization_id: true,
      is_active: true,
    },
  });

  if (!targetProfile) {
    throw new Error("Team member not found.");
  }

  if (targetProfile.is_active) {
    throw new Error("This team member is already active.");
  }

  const selectedRoleId = roleId ?? (await getDefaultRoleId());

  if (!selectedRoleId) {
    throw new Error("No role is available for reactivation.");
  }

  const role = await getRoleOrThrow(selectedRoleId, organization.id);

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      is_active: true,
    },
  });

  const currentRoles = await prisma.userRole.findMany({
    where: {
      organization_id: organization.id,
      user_id: userId,
    },
    select: {
      id: true,
    },
  });

  if (currentRoles.length === 0) {
    await prisma.userRole.create({
      data: {
        organization_id: organization.id,
        user_id: userId,
        role_id: selectedRoleId,
        assigned_by: user.id,
      },
    });
  }

  await logActivity(organization.id, "team.member.reactivated", "profile", userId, {
    email: targetProfile.email,
    role_id: selectedRoleId,
    role_name: role.name,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function createRole(input: RoleInput) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const parsedInputResult = roleInputSchema.safeParse(input);

  if (!parsedInputResult.success) {
    throw new Error(parsedInputResult.error.errors[0]?.message ?? "Please check the role form and try again.");
  }

  const parsedInput = parsedInputResult.data;
  const slug = parsedInput.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const data = await prisma.role.create({
    data: {
      organization_id: organization.id,
      name: parsedInput.name,
      slug: `${slug}-${Date.now()}`,
      description: parsedInput.description || null,
      is_system: false,
      updated_at: new Date(),
    },
    select: {
      id: true,
      name: true,
    },
  });

  await logActivity(organization.id, "team.role.created", "role", data.id, {
    name: data.name,
  });

  revalidatePath("/team");
  return data;
}

export async function updateRole(roleId: string, input: RoleInput) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const role = await getRoleOrThrow(roleId, organization.id);
  const parsedInputResult = roleInputSchema.safeParse(input);

  if (!parsedInputResult.success) {
    throw new Error(parsedInputResult.error.errors[0]?.message ?? "Please check the role form and try again.");
  }

  const parsedInput = parsedInputResult.data;

  if (role.is_system) {
    throw new Error("System role names cannot be edited.");
  }

  await prisma.role.update({
    where: {
      id: roleId,
    },
    data: {
      name: parsedInput.name,
      description: parsedInput.description || null,
      updated_at: new Date(),
    },
  });

  await logActivity(organization.id, "team.role.updated", "role", roleId, {
    name: parsedInput.name,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function archiveRole(roleId: string) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const role = await getRoleOrThrow(roleId, organization.id);

  if (role.is_system) {
    throw new Error("System roles cannot be archived.");
  }

  const count = await prisma.userRole.count({
    where: {
      organization_id: organization.id,
      role_id: roleId,
    },
  });

  if (count > 0) {
    throw new Error("Reassign team members before archiving this role.");
  }

  await prisma.role.delete({
    where: {
      id: roleId,
    },
  });

  await logActivity(organization.id, "team.role.archived", "role", roleId, {
    name: role.name,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const role = await getRoleOrThrow(roleId, organization.id);
  const permissions = await getPermissions();

  const permissionMap = new Map(permissions.map((permission) => [permission.id, permission]));
  const validPermissionIds = permissionIds.filter((permissionId) => permissionMap.has(permissionId));
  const finalPermissionIds =
    role.slug === "organization-admin" ? permissions.map((permission) => permission.id) : validPermissionIds;

  await prisma.rolePermission.deleteMany({
    where: {
      role_id: roleId,
    },
  });

  if (finalPermissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: finalPermissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      })),
      skipDuplicates: true,
    });
  }

  await logActivity(organization.id, "team.role.permissions_updated", "role", roleId, {
    permission_ids: finalPermissionIds,
  });

  revalidatePath("/team");
  return { success: true };
}
