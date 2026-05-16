import { prisma } from "@/lib/prisma";
import { ensureDefaultCompanyCategories } from "@/lib/crm/default-company-categories";
import { slugify } from "@/lib/crm/utils";
import { resolveSuperAdminAccess } from "@/lib/auth/super-admin";
import { PERMISSION_GROUPS } from "@/lib/team/types";
import {
  listActiveWorkspaceMembershipsForUser,
} from "@/lib/workspace/memberships";
import type { WorkspaceSummary } from "./types";

const DEFAULT_ROLE_DEFINITIONS = [
  {
    name: "Organization Admin",
    slug: "organization-admin",
    description: "Full access to workspace administration and CRM data.",
  },
  {
    name: "Sales Manager",
    slug: "sales-manager",
    description: "Manage sales team activity, targets, pipeline, and reports.",
  },
  {
    name: "Sales Executive",
    slug: "sales-executive",
    description: "Work assigned leads, meetings, pipeline, and follow-ups.",
  },
  {
    name: "Support User",
    slug: "support-user",
    description: "Assist with support requests and client follow-up needs.",
  },
  {
    name: "Viewer",
    slug: "viewer",
    description: "Read-only visibility into CRM data.",
  },
] as const;

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  "organization-admin": [
    "dashboard.view",
    "companies.view", "companies.create", "companies.update", "companies.archive", "companies.delete",
    "contacts.view", "contacts.create", "contacts.update", "contacts.archive",
    "meetings.view", "meetings.create", "meetings.update", "meetings.archive",
    "followups.view", "followups.create", "followups.update", "followups.complete", "followups.cancel", "followups.archive",
    "documents.view", "documents.upload", "documents.update", "documents.download", "documents.archive",
    "help_requests.view", "help_requests.create", "help_requests.assign", "help_requests.resolve", "help_requests.reject", "help_requests.archive",
    "reports.view", "reports.export",
    "team.view", "team.view_activity", "team.invite", "team.manage_hierarchy", "team.manage_targets", "team.update_role", "team.deactivate",
    "settings.view", "settings.manage",
    "scoring.view", "scoring.manage", "rewards.manage", "leaderboard.view",
  ],
  "sales-manager": [
    "dashboard.view",
    "companies.view", "companies.create", "companies.update", "companies.archive",
    "contacts.view", "contacts.create", "contacts.update", "contacts.archive",
    "meetings.view", "meetings.create", "meetings.update", "meetings.archive",
    "followups.view", "followups.create", "followups.update", "followups.complete", "followups.cancel", "followups.archive",
    "documents.view", "documents.upload", "documents.update", "documents.download", "documents.archive",
    "help_requests.view", "help_requests.create", "help_requests.assign", "help_requests.resolve",
    "reports.view", "reports.export",
    "team.view", "team.view_activity", "team.manage_hierarchy", "team.manage_targets",
    "scoring.view", "leaderboard.view",
  ],
  "sales-executive": [
    "dashboard.view",
    "companies.view", "companies.create", "companies.update", "companies.archive",
    "contacts.view", "contacts.create", "contacts.update", "contacts.archive",
    "meetings.view", "meetings.create", "meetings.update",
    "followups.view", "followups.create", "followups.update", "followups.complete", "followups.cancel",
    "documents.view", "documents.upload", "documents.update", "documents.download",
    "leaderboard.view",
  ],
  "support-user": [
    "dashboard.view",
    "companies.view",
    "contacts.view",
    "meetings.view",
    "followups.view", "followups.create", "followups.update", "followups.complete", "followups.cancel",
    "documents.view", "documents.upload", "documents.update", "documents.download", "documents.archive",
    "help_requests.view", "help_requests.create", "help_requests.assign", "help_requests.resolve", "help_requests.reject", "help_requests.archive",
    "leaderboard.view",
  ],
  viewer: [
    "dashboard.view",
    "companies.view",
    "contacts.view",
    "meetings.view",
    "followups.view",
    "documents.view",
    "help_requests.view",
    "reports.view",
    "team.view",
    "settings.view",
    "leaderboard.view",
  ],
};

const DEFAULT_PIPELINE_STAGES = [
  ["New Lead", "new-lead", 1, 5, false, false],
  ["Contacted", "contacted", 2, 10, false, false],
  ["Meeting Scheduled", "meeting-scheduled", 3, 25, false, false],
  ["Meeting Done", "meeting-done", 4, 35, false, false],
  ["Requirement Collected", "requirement-collected", 5, 45, false, false],
  ["Proposal Sent", "proposal-sent", 6, 60, false, false],
  ["Negotiation", "negotiation", 7, 75, false, false],
  ["Won", "won", 8, 100, true, false],
  ["Lost", "lost", 9, 0, false, true],
  ["Hold", "hold", 10, 20, false, false],
] as const;

export function buildWorkspaceSlug(name: string) {
  const baseSlug = slugify(name) || "workspace";
  return `${baseSlug}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function formatPermissionName(key: string) {
  return key
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function canCreateWorkspaceForUser(
  userId: string,
  workspacesOverride?: WorkspaceSummary[],
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      email: true,
      is_super_admin: true,
    },
  });

  if (!user) {
    return false;
  }

  if (resolveSuperAdminAccess({ email: user.email, isSuperAdmin: user.is_super_admin })) {
    return true;
  }

  const workspaces = workspacesOverride ?? await listAccessibleWorkspacesForUser(userId);

  if (workspaces.length === 0) {
    return true;
  }

  return workspaces.some(
    (workspace) => workspace.is_owner || workspace.role_slug === "organization-admin",
  );
}

export async function listAccessibleWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      organization_id: true,
    },
  });

  if (!user) {
    return [];
  }

  const memberships = await listActiveWorkspaceMembershipsForUser(userId);

  if (memberships.length === 0) {
    return [];
  }

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const [organizations, userRoles] = await Promise.all([
    prisma.organization.findMany({
      where: {
        id: {
          in: organizationIds,
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        company_size: true,
        owner_user_id: true,
      },
    }),
    prisma.userRole.findMany({
      where: {
        user_id: userId,
        organization_id: {
          in: organizationIds,
        },
      },
      orderBy: {
        assigned_at: "desc",
      },
      select: {
        organization_id: true,
        role: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  const organizationMap = new Map(organizations.map((organization) => [organization.id, organization]));
  const roleMap = new Map<string, { role_name: string | null; role_slug: string | null }>();

  for (const userRole of userRoles) {
    if (!roleMap.has(userRole.organization_id)) {
      roleMap.set(userRole.organization_id, {
        role_name: userRole.role?.name ?? null,
        role_slug: userRole.role?.slug ?? null,
      });
    }
  }

  const workspaces = memberships
    .map((membership) => {
      const organization = organizationMap.get(membership.organization_id);

      if (!organization) {
        return null;
      }

      const role = roleMap.get(membership.organization_id) ?? {
        role_name: null,
        role_slug: null,
      };
      const isOwner = organization.owner_user_id === userId;

      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        company_size: organization.company_size,
        owner_user_id: organization.owner_user_id,
        role_name: isOwner ? (role.role_name ?? "Organization Admin") : role.role_name,
        role_slug: isOwner ? (role.role_slug ?? "organization-admin") : role.role_slug,
        is_owner: isOwner,
        is_active: organization.id === user.organization_id,
      } satisfies WorkspaceSummary;
    })
    .filter((workspace): workspace is WorkspaceSummary => Boolean(workspace))
    .sort((left, right) => {
      if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
      if (left.is_owner !== right.is_owner) return left.is_owner ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  if (workspaces.length === 0) {
    return workspaces;
  }

  if (workspaces.some((workspace) => workspace.is_active)) {
    return workspaces;
  }

  return workspaces.map((workspace, index) => ({
    ...workspace,
    is_active: index === 0,
  }));
}

export async function resolveActiveWorkspaceIdForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      organization_id: true,
    },
  });

  if (!user) {
    return null;
  }

  const workspaces = await listAccessibleWorkspacesForUser(userId);

  if (workspaces.length === 0) {
    if (user.organization_id) {
      await prisma.user.update({
        where: { id: userId },
        data: { organization_id: null },
      });
    }

    return null;
  }

  if (user.organization_id && workspaces.some((workspace) => workspace.id === user.organization_id)) {
    return user.organization_id;
  }

  const nextWorkspaceId = workspaces[0]?.id ?? null;

  if (nextWorkspaceId && user.organization_id !== nextWorkspaceId) {
    await prisma.user.update({
      where: { id: userId },
      data: { organization_id: nextWorkspaceId, is_active: true },
    });
  }

  return nextWorkspaceId;
}

export async function switchWorkspaceForUser(userId: string, organizationId: string) {
  const workspaces = await listAccessibleWorkspacesForUser(userId);
  const target = workspaces.find((workspace) => workspace.id === organizationId);

  if (!target) {
    throw new Error("You do not have access to that workspace.");
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      organization_id: target.id,
      is_active: true,
    },
  });

  return target;
}

export async function createWorkspaceForUser(userId: string, input: { name: string; companySize: string }) {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      is_super_admin: true,
    },
  });

  if (!existingUser) {
    throw new Error("Authentication required.");
  }

  if (!resolveSuperAdminAccess({ email: existingUser.email, isSuperAdmin: existingUser.is_super_admin })) {
    const canCreateWorkspace = await canCreateWorkspaceForUser(userId);

    if (!canCreateWorkspace) {
      throw new Error("Only workspace administrators can create a new workspace.");
    }
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const permissionKeys = Array.from(
      new Set([
        ...Object.values(PERMISSION_GROUPS).flatMap((group) => group.permissions),
        ...Object.values(DEFAULT_ROLE_PERMISSIONS).flatMap((permissionKeys) => permissionKeys),
      ]),
    );

    await tx.permission.createMany({
      data: permissionKeys.map((key) => ({
        key,
        name: formatPermissionName(key),
        description: `${formatPermissionName(key)} permission.`,
      })),
      skipDuplicates: true,
    });

    const organization = await tx.organization.create({
      data: {
        name: input.name.trim(),
        slug: buildWorkspaceSlug(input.name),
        company_size: input.companySize.trim() || null,
        owner_user_id: userId,
        updated_at: now,
      },
      select: {
        id: true,
      },
    });

    await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        organization_id: organization.id,
        is_active: true,
      },
    });

    const roles = await Promise.all(
      DEFAULT_ROLE_DEFINITIONS.map((role) =>
        tx.role.create({
          data: {
            organization_id: organization.id,
            name: role.name,
            slug: role.slug,
            description: role.description,
            is_system: true,
            updated_at: now,
          },
          select: {
            id: true,
            slug: true,
          },
        }),
      ),
    );

    const permissions = await tx.permission.findMany({
      where: {
        key: {
          in: Array.from(
            new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flatMap((permissionKeys) => permissionKeys)),
          ),
        },
      },
      select: {
        id: true,
        key: true,
      },
    });

    const permissionMap = new Map(permissions.map((permission) => [permission.key, permission.id]));
    const rolePermissionRows = roles.flatMap((role) =>
      (DEFAULT_ROLE_PERMISSIONS[role.slug] ?? [])
        .map((key) => permissionMap.get(key))
        .filter((permissionId): permissionId is string => Boolean(permissionId))
        .map((permissionId) => ({
          role_id: role.id,
          permission_id: permissionId,
        })),
    );

    if (rolePermissionRows.length > 0) {
      await tx.rolePermission.createMany({
        data: rolePermissionRows,
        skipDuplicates: true,
      });
    }

    const adminRole = roles.find((role) => role.slug === "organization-admin");

    await tx.$executeRaw`
      insert into public.workspace_memberships (
        organization_id,
        user_id,
        status,
        joined_at,
        deactivated_at,
        manager_user_id,
        invited_by,
        created_at,
        updated_at
      )
      values (
        ${organization.id}::uuid,
        ${userId}::uuid,
        'active',
        now(),
        null,
        null,
        ${userId}::uuid,
        now(),
        now()
      )
      on conflict (organization_id, user_id)
      do update set
        status = 'active',
        deactivated_at = null,
        invited_by = coalesce(public.workspace_memberships.invited_by, excluded.invited_by),
        updated_at = now()
    `;

    if (adminRole) {
      await tx.userRole.upsert({
        where: {
          organization_id_user_id_role_id: {
            organization_id: organization.id,
            user_id: userId,
            role_id: adminRole.id,
          },
        },
        update: {
          assigned_by: userId,
        },
        create: {
          organization_id: organization.id,
          user_id: userId,
          role_id: adminRole.id,
          assigned_by: userId,
        },
      });
    }

    for (const [name, slug, position, probability, isWon, isLost] of DEFAULT_PIPELINE_STAGES) {
      await tx.$executeRaw`
        insert into public.pipeline_stages (
          organization_id,
          name,
          slug,
          position,
          probability,
          is_won,
          is_lost,
          created_at,
          updated_at
        )
        values (
          ${organization.id}::uuid,
          ${name},
          ${slug},
          ${position},
          ${probability},
          ${isWon},
          ${isLost},
          ${now}::timestamptz,
          ${now}::timestamptz
        )
      `;
    }

    await ensureDefaultCompanyCategories({
      db: tx,
      organizationId: organization.id,
      userId,
    });

    return organization.id;
  });
}
