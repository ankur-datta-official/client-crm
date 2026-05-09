import "server-only";

import { getCurrentProfile, hasPermission, requireAuth, requireOrganization } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/notifications";
import { prisma } from "@/lib/prisma";

type MinimalProfile = {
  id: string;
  full_name: string | null;
  email: string;
  manager_user_id: string | null;
};

export async function canManageTeamMember(targetUserId: string) {
  const user = await requireAuth();
  const organization = await requireOrganization();

  if (user.id === targetUserId) {
    return true;
  }

  if (await hasPermission("settings.manage")) {
    return true;
  }

  const targetProfile = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      organization_id: organization.id,
      manager_user_id: user.id,
    },
    select: {
      id: true,
    },
  });

  return Boolean(targetProfile);
}

export async function ensureCanManageTeamMember(targetUserId: string, message = "You do not have permission to manage this team member.") {
  const allowed = await canManageTeamMember(targetUserId);

  if (!allowed) {
    throw new Error(message);
  }
}

export async function ensureCanAssignUser(targetUserId: string) {
  await ensureCanManageTeamMember(
    targetUserId,
    "You can only assign work to yourself, your direct junior team members, or any user when you have admin settings access.",
  );
}

export async function ensureCanWorkWithCompany(companyId: string) {
  const user = await requireAuth();
  const organization = await requireOrganization();

  if (await hasPermission("settings.manage")) {
    return;
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; assigned_user_id: string | null }>>`
    select id, assigned_user_id::text as assigned_user_id
    from public.companies
    where id = ${companyId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const company = rows[0] ?? null;

  if (!company) {
    throw new Error("Company was not found in your workspace.");
  }

  if (!company.assigned_user_id || company.assigned_user_id === user.id) {
    return;
  }

  const canManageAssignedUser = await canManageTeamMember(company.assigned_user_id);
  if (!canManageAssignedUser) {
    throw new Error("Only the assigned team member, their senior, or an admin can update this company.");
  }
}

export async function getAssignableTeamMembers() {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const isAdmin = await hasPermission("settings.manage");

  const members = await prisma.user.findMany({
    where: {
      organization_id: organization.id,
      is_active: true,
      ...(isAdmin
        ? {}
        : {
            OR: [
              { id: user.id },
              { manager_user_id: user.id },
            ],
          }),
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
      name: true,
      email: true,
    },
  });

  return members.map((member) => ({
    id: member.id,
    full_name: member.name,
    email: member.email,
  }));
}

async function getDirectManagerProfile(userId: string, organizationId: string) {
  const actorProfile = await prisma.user.findFirst({
    where: {
      id: userId,
      organization_id: organizationId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      manager_user_id: true,
    },
  });

  const normalizedActorProfile: MinimalProfile | null = actorProfile
    ? {
        id: actorProfile.id,
        full_name: actorProfile.name,
        email: actorProfile.email,
        manager_user_id: actorProfile.manager_user_id,
      }
    : null;

  if (!normalizedActorProfile?.manager_user_id) {
    return null;
  }

  const manager = await prisma.user.findFirst({
    where: {
      id: normalizedActorProfile.manager_user_id,
      organization_id: organizationId,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return manager
    ? {
        id: manager.id,
        full_name: manager.name,
        email: manager.email,
      }
    : null;
}

export async function notifyDirectManagerOfActivity(input: {
  actorUserId?: string | null;
  title: string;
  message: string;
  link: string;
}) {
  const actorUserId = input.actorUserId ?? null;
  const profile = await getCurrentProfile();

  if (!actorUserId || !profile?.organization_id) {
    return;
  }

  const manager = await getDirectManagerProfile(actorUserId, profile.organization_id);
  if (!manager || manager.id === actorUserId) {
    return;
  }

  await createNotification({
    userId: manager.id,
    type: "team.subordinate_activity",
    title: input.title,
    message: input.message,
    link: input.link,
  });
}
