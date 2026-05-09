import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/crm/utils";
import { PERMISSION_GROUPS } from "@/lib/team/types";
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
    description: "Manage sales team activity, pipeline, and reports.",
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
    "team.view", "team.invite", "team.update_role", "team.deactivate",
    "settings.view", "settings.manage",
    "subscription.view", "subscription.manage",
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
    "team.view",
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
    "subscription.view",
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

const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    name: "Starter",
    slug: "starter",
    description: "Essential CRM access for a small sales workspace.",
    monthly_price: 0,
    max_users: 5,
    max_organizations: 1,
    max_companies: 500,
    storage_limit_mb: 1024,
    file_size_limit_mb: 10,
    custom_pipeline: false,
    pdf_export: false,
    csv_import: false,
    advanced_reports: false,
    audit_log: false,
    is_active: true,
  },
  {
    name: "Professional",
    slug: "professional",
    description: "Team-ready CRM plan with import tools and richer reporting.",
    monthly_price: 29,
    max_users: 15,
    max_organizations: 1,
    max_companies: 5000,
    storage_limit_mb: 5120,
    file_size_limit_mb: 25,
    custom_pipeline: true,
    pdf_export: true,
    csv_import: true,
    advanced_reports: true,
    audit_log: false,
    is_active: true,
  },
  {
    name: "Business",
    slug: "business",
    description: "Higher-capacity CRM plan for growing revenue teams.",
    monthly_price: 79,
    max_users: 50,
    max_organizations: 1,
    max_companies: 25000,
    storage_limit_mb: 20480,
    file_size_limit_mb: 50,
    custom_pipeline: true,
    pdf_export: true,
    csv_import: true,
    advanced_reports: true,
    audit_log: true,
    is_active: true,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "Unlimited-scale CRM plan with full feature access.",
    monthly_price: 199,
    max_users: null,
    max_organizations: 1,
    max_companies: null,
    storage_limit_mb: null,
    file_size_limit_mb: 100,
    custom_pipeline: true,
    pdf_export: true,
    csv_import: true,
    advanced_reports: true,
    audit_log: true,
    is_active: true,
  },
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

function dedupeWorkspaces(workspaces: WorkspaceSummary[]) {
  const byId = new Map<string, WorkspaceSummary>();

  for (const workspace of workspaces) {
    const existing = byId.get(workspace.id);

    if (!existing || (!existing.is_owner && workspace.is_owner)) {
      byId.set(workspace.id, workspace);
      continue;
    }

    if (
      existing
      && existing.role_slug !== "organization-admin"
      && workspace.role_slug === "organization-admin"
    ) {
      byId.set(workspace.id, workspace);
    }
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
    if (left.is_owner !== right.is_owner) return left.is_owner ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export async function canCreateWorkspaceForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      is_super_admin: true,
    },
  });

  if (!user) {
    return false;
  }

  if (user.is_super_admin) {
    return true;
  }

  const workspaces = await listAccessibleWorkspacesForUser(userId);

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
      ownedOrganizations: {
        select: {
          id: true,
          name: true,
          slug: true,
          company_size: true,
          owner_user_id: true,
        },
      },
      userRoles: {
        select: {
          organization_id: true,
          role: {
            select: {
              name: true,
              slug: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              company_size: true,
              owner_user_id: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return [];
  }

  const owned = user.ownedOrganizations.map((organization) => ({
    ...organization,
    role_name: "Organization Admin",
    role_slug: "organization-admin",
    is_owner: true,
    is_active: organization.id === user.organization_id,
  }));

  const memberships = user.userRoles
    .filter((record) => record.organization)
    .map((record) => ({
      id: record.organization.id,
      name: record.organization.name,
      slug: record.organization.slug,
      company_size: record.organization.company_size,
      owner_user_id: record.organization.owner_user_id,
      role_name: record.role?.name ?? null,
      role_slug: record.role?.slug ?? null,
      is_owner: record.organization.owner_user_id === userId,
      is_active: record.organization.id === user.organization_id,
    }));

  const workspaces = dedupeWorkspaces([...owned, ...memberships]);

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
      is_super_admin: true,
    },
  });

  if (!existingUser) {
    throw new Error("Authentication required.");
  }

  if (!existingUser.is_super_admin) {
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

    await tx.subscriptionPlan.createMany({
      data: DEFAULT_SUBSCRIPTION_PLANS.map((plan) => ({
        ...plan,
      })),
      skipDuplicates: true,
    });

    const starterPlan = await tx.subscriptionPlan.findFirst({
      where: {
        slug: "starter",
      },
      select: {
        id: true,
      },
    });

    if (!starterPlan) {
      throw new Error("Starter subscription plan is missing. Run seed migration first.");
    }

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

    await tx.organizationSubscription.create({
      data: {
        organization_id: organization.id,
        plan_id: starterPlan.id,
        status: "trialing",
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        updated_at: now,
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

    return organization.id;
  });
}
