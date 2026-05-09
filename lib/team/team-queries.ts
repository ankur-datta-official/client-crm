"use server";

import { getCurrentUser, getUserPermissions, requireOrganization } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Permission, RoleRow, RoleWithPermissions, TeamInvitation, TeamMember } from "./types";

type InvitationPreview = {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  role_id: string;
  role_name: string | null;
  status: TeamInvitation["status"];
  expires_at: string;
};

function normalizeInvitationStatus<T extends { status: TeamInvitation["status"]; expires_at: string }>(invitation: T): T {
  if (invitation.status === "pending" && new Date(invitation.expires_at).getTime() < Date.now()) {
    return { ...invitation, status: "expired" };
  }

  return invitation;
}

function mapRoleRow(role: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  organization_id: string;
}): RoleRow {
  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    is_system: role.is_system,
    organization_id: role.organization_id,
  };
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const organization = await requireOrganization();

  const members = await prisma.user.findMany({
    where: {
      organization_id: organization.id,
    },
    orderBy: [
      {
        name: "asc",
      },
      {
        email: "asc",
      },
    ],
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      job_title: true,
      department: true,
      phone: true,
      organization_id: true,
      created_at: true,
      is_active: true,
      manager_user_id: true,
      manager: {
        select: {
          name: true,
          email: true,
        },
      },
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
              name: true,
              slug: true,
            },
          },
        },
      },
      sessions: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
        select: {
          updatedAt: true,
        },
      },
    },
  });

  return members.map((member) => {
    const roleAssignment = member.userRoles[0] ?? null;
    const latestSession = member.sessions[0] ?? null;

    return {
      id: member.id,
      email: member.email,
      full_name: member.name,
      avatar_url: member.image,
      job_title: member.job_title,
      department: member.department,
      phone: member.phone,
      organization_id: member.organization_id,
      created_at: member.created_at.toISOString(),
      is_active: member.is_active,
      last_login_at: latestSession?.updatedAt.toISOString() ?? null,
      role_id: roleAssignment?.role_id ?? null,
      role_name: roleAssignment?.role.name ?? null,
      role_slug: roleAssignment?.role.slug ?? null,
      manager_user_id: member.manager_user_id,
      manager_name: member.manager?.name ?? null,
      manager_email: member.manager?.email ?? null,
    };
  });
}

export async function getTeamMemberById(userId: string): Promise<TeamMember | null> {
  const members = await getTeamMembers();
  return members.find((member) => member.id === userId) ?? null;
}

export async function getTeamInvitations(): Promise<TeamInvitation[]> {
  const organization = await requireOrganization();
  const invitations = await prisma.teamInvitation.findMany({
    where: {
      organization_id: organization.id,
    },
    orderBy: {
      created_at: "desc",
    },
    select: {
      id: true,
      organization_id: true,
      email: true,
      role_id: true,
      invited_by: true,
      token: true,
      full_name: true,
      job_title: true,
      department: true,
      phone: true,
      status: true,
      expires_at: true,
      accepted_at: true,
      created_at: true,
      role: {
        select: {
          name: true,
          slug: true,
        },
      },
      invitedBy: {
        select: {
          name: true,
        },
      },
    },
  });

  return invitations.map((invitation) => {
    return normalizeInvitationStatus({
      id: invitation.id,
      organization_id: invitation.organization_id,
      email: invitation.email,
      role_id: invitation.role_id,
      invited_by: invitation.invited_by,
      token: invitation.token,
      full_name: invitation.full_name,
      job_title: invitation.job_title,
      department: invitation.department,
      phone: invitation.phone,
      status: invitation.status as TeamInvitation["status"],
      expires_at: invitation.expires_at.toISOString(),
      accepted_at: invitation.accepted_at?.toISOString() ?? null,
      created_at: invitation.created_at.toISOString(),
      role_name: invitation.role?.name ?? null,
      role_slug: invitation.role?.slug ?? null,
      invited_by_name: invitation.invitedBy?.name ?? "Unknown",
      invite_link: `/auth/accept-invite?token=${invitation.token}`,
    });
  });
}

export async function getRoles(): Promise<RoleRow[]> {
  const organization = await requireOrganization();
  const roles = await prisma.role.findMany({
    where: {
      organization_id: organization.id,
    },
    orderBy: [
      {
        is_system: "desc",
      },
      {
        name: "asc",
      },
    ],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      is_system: true,
      organization_id: true,
    },
  });

  return roles.map(mapRoleRow);
}

export async function getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
  const organization = await requireOrganization();
  const role = await prisma.role.findFirst({
    where: {
      id: roleId,
      organization_id: organization.id,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      is_system: true,
      organization_id: true,
    },
  });

  if (!role) {
    return null;
  }

  return {
    ...mapRoleRow(role),
    permissions: await getRolePermissions(roleId),
  };
}

export async function getPermissions(): Promise<Permission[]> {
  await requireOrganization();
  const permissions = await prisma.permission.findMany({
    orderBy: {
      key: "asc",
    },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
    },
  });

  return permissions;
}

export async function getRolePermissions(roleId: string): Promise<string[]> {
  const organization = await requireOrganization();
  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      role_id: roleId,
      role: {
        organization_id: organization.id,
      },
    },
    select: {
      permission: {
        select: {
          key: true,
        },
      },
    },
  });

  return rolePermissions
    .map((row) => row.permission.key)
    .filter((value): value is string => Boolean(value));
}

export async function getRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const roles = await getRoles();
  const permissions = await Promise.all(roles.map((role) => getRolePermissions(role.id)));

  return roles.map((role, index) => ({
    ...role,
    permissions: permissions[index] ?? [],
  }));
}

export async function getCurrentUserPermissions(): Promise<string[]> {
  return getUserPermissions();
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const invitation = await prisma.teamInvitation.findUnique({
    where: {
      token,
    },
    select: {
      id: true,
      organization_id: true,
      email: true,
      full_name: true,
      job_title: true,
      department: true,
      phone: true,
      role_id: true,
      status: true,
      expires_at: true,
      role: {
        select: {
          name: true,
        },
      },
      organization: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!invitation) {
    return null;
  }

  return normalizeInvitationStatus({
    id: invitation.id,
    organization_id: invitation.organization_id,
    organization_name: invitation.organization.name,
    email: invitation.email,
    full_name: invitation.full_name,
    job_title: invitation.job_title,
    department: invitation.department,
    phone: invitation.phone,
    role_id: invitation.role_id,
    role_name: invitation.role?.name ?? null,
    status: invitation.status as TeamInvitation["status"],
    expires_at: invitation.expires_at.toISOString(),
  });
}

export async function getPendingInvitationsCount(): Promise<number> {
  const organization = await requireOrganization();
  return prisma.teamInvitation.count({
    where: {
      organization_id: organization.id,
      status: "pending",
    },
  });
}

export async function getActiveUsersCount(): Promise<number> {
  const organization = await requireOrganization();
  return prisma.user.count({
    where: {
      organization_id: organization.id,
      is_active: true,
    },
  });
}
