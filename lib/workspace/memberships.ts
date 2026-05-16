import "server-only";

import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WorkspaceMembershipStatus = "active" | "inactive";

export type WorkspaceMembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  status: WorkspaceMembershipStatus;
  joined_at: Date;
  deactivated_at: Date | null;
  manager_user_id: string | null;
  invited_by: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapWorkspaceMembershipRow(row: WorkspaceMembershipRow): WorkspaceMembershipRow {
  return {
    ...row,
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

export function isWorkspaceMembershipsRelationMissingError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2010"
    && error.message.includes("42P01")
    && error.message.includes("workspace_memberships")
  );
}

export const hasWorkspaceMembershipsTable = cache(async () => {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: string | null }>>`
      select to_regclass('public.workspace_memberships')::text as exists
    `;

    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
});

async function getLegacyWorkspaceMembership(
  userId: string,
  organizationId: string,
): Promise<WorkspaceMembershipRow | null> {
  const profile = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      organization_id: true,
      manager_user_id: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!profile || profile.organization_id !== organizationId) {
    return null;
  }

  return {
    id: `${organizationId}:${userId}`,
    organization_id: organizationId,
    user_id: userId,
    status: profile.is_active ? "active" : "inactive",
    joined_at: profile.created_at,
    deactivated_at: profile.is_active ? null : profile.updated_at,
    manager_user_id: profile.manager_user_id ?? null,
    invited_by: null,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

export async function getWorkspaceMembership(
  userId: string,
  organizationId: string,
): Promise<WorkspaceMembershipRow | null> {
  if (!(await hasWorkspaceMembershipsTable())) {
    return getLegacyWorkspaceMembership(userId, organizationId);
  }

  const rows = await prisma.$queryRaw<WorkspaceMembershipRow[]>`
    select
      wm.id::text as id,
      wm.organization_id::text as organization_id,
      wm.user_id::text as user_id,
      wm.status,
      wm.joined_at,
      wm.deactivated_at,
      wm.manager_user_id::text as manager_user_id,
      wm.invited_by::text as invited_by,
      wm.created_at,
      wm.updated_at
    from public.workspace_memberships wm
    where wm.user_id = ${userId}::uuid
      and wm.organization_id = ${organizationId}::uuid
    limit 1
  `;

  return rows[0] ? mapWorkspaceMembershipRow(rows[0]) : null;
}

export async function getActiveWorkspaceMembership(
  userId: string,
  organizationId: string,
): Promise<WorkspaceMembershipRow | null> {
  const membership = await getWorkspaceMembership(userId, organizationId);
  return membership?.status === "active" ? membership : null;
}

export async function listWorkspaceMembershipsForUser(userId: string): Promise<WorkspaceMembershipRow[]> {
  if (!(await hasWorkspaceMembershipsTable())) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        organization_id: true,
        manager_user_id: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        ownedOrganizations: {
          select: {
            id: true,
            created_at: true,
            updated_at: true,
          },
        },
        userRoles: {
          select: {
            organization_id: true,
            assigned_at: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    const byOrganizationId = new Map<string, WorkspaceMembershipRow>();

    const upsertLegacy = (
      organizationId: string | null | undefined,
      input: Partial<WorkspaceMembershipRow> & { joined_at?: Date; updated_at?: Date },
    ) => {
      if (!organizationId) {
        return;
      }

      const existing = byOrganizationId.get(organizationId);
      const joinedAt = input.joined_at ?? existing?.joined_at ?? user.created_at;
      const updatedAt = input.updated_at ?? existing?.updated_at ?? user.updated_at;
      const status = input.status ?? existing?.status ?? "active";

      byOrganizationId.set(organizationId, {
        id: existing?.id ?? `${organizationId}:${userId}`,
        organization_id: organizationId,
        user_id: userId,
        status,
        joined_at: joinedAt,
        deactivated_at: status === "inactive" ? (input.deactivated_at ?? updatedAt) : null,
        manager_user_id: input.manager_user_id ?? existing?.manager_user_id ?? null,
        invited_by: input.invited_by ?? existing?.invited_by ?? null,
        created_at: existing?.created_at ?? joinedAt,
        updated_at: updatedAt,
      });
    };

    upsertLegacy(user.organization_id, {
      status: user.is_active ? "active" : "inactive",
      manager_user_id: user.manager_user_id ?? null,
      joined_at: user.created_at,
      updated_at: user.updated_at,
    });

    for (const organization of user.ownedOrganizations) {
      upsertLegacy(organization.id, {
        status: "active",
        joined_at: organization.created_at,
        updated_at: organization.updated_at,
      });
    }

    for (const userRole of user.userRoles) {
      upsertLegacy(userRole.organization_id, {
        status: "active",
        joined_at: userRole.assigned_at,
        updated_at: user.updated_at,
      });
    }

    return Array.from(byOrganizationId.values()).sort((left, right) => {
      if (left.organization_id === user.organization_id) return -1;
      if (right.organization_id === user.organization_id) return 1;
      return left.joined_at.getTime() - right.joined_at.getTime();
    });
  }

  const rows = await prisma.$queryRaw<WorkspaceMembershipRow[]>`
    select
      wm.id::text as id,
      wm.organization_id::text as organization_id,
      wm.user_id::text as user_id,
      wm.status,
      wm.joined_at,
      wm.deactivated_at,
      wm.manager_user_id::text as manager_user_id,
      wm.invited_by::text as invited_by,
      wm.created_at,
      wm.updated_at
    from public.workspace_memberships wm
    where wm.user_id = ${userId}::uuid
    order by wm.joined_at asc, wm.created_at asc
  `;

  return rows.map(mapWorkspaceMembershipRow);
}

export async function listActiveWorkspaceMembershipsForUser(userId: string): Promise<WorkspaceMembershipRow[]> {
  const memberships = await listWorkspaceMembershipsForUser(userId);
  return memberships.filter((membership) => membership.status === "active");
}

export async function upsertWorkspaceMembership(input: {
  organizationId: string;
  userId: string;
  invitedBy?: string | null;
  managerUserId?: string | null;
  status?: WorkspaceMembershipStatus;
}) {
  if (!(await hasWorkspaceMembershipsTable())) {
    const currentProfile = await prisma.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        organization_id: true,
      },
    });

    if (currentProfile?.organization_id !== input.organizationId) {
      await prisma.user.update({
        where: {
          id: input.userId,
        },
        data: {
          organization_id: input.organizationId,
          is_active: input.status !== "inactive",
          ...(input.managerUserId !== undefined ? { manager_user_id: input.managerUserId } : {}),
        },
      });
    } else {
      await prisma.user.update({
        where: {
          id: input.userId,
        },
        data: {
          is_active: input.status !== "inactive",
          ...(input.managerUserId !== undefined ? { manager_user_id: input.managerUserId } : {}),
        },
      });
    }

    return getLegacyWorkspaceMembership(input.userId, input.organizationId);
  }

  const status = input.status ?? "active";
  const deactivatedAt = status === "inactive" ? Prisma.sql`now()` : Prisma.sql`null`;

  const rows = await prisma.$queryRaw<WorkspaceMembershipRow[]>`
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
      ${input.organizationId}::uuid,
      ${input.userId}::uuid,
      ${status},
      now(),
      ${deactivatedAt},
      ${input.managerUserId ?? null}::uuid,
      ${input.invitedBy ?? null}::uuid,
      now(),
      now()
    )
    on conflict (organization_id, user_id)
    do update set
      status = excluded.status,
      deactivated_at = excluded.deactivated_at,
      invited_by = coalesce(excluded.invited_by, public.workspace_memberships.invited_by),
      manager_user_id = coalesce(public.workspace_memberships.manager_user_id, excluded.manager_user_id),
      updated_at = now()
    returning
      workspace_memberships.id::text as id,
      workspace_memberships.organization_id::text as organization_id,
      workspace_memberships.user_id::text as user_id,
      workspace_memberships.status,
      workspace_memberships.joined_at,
      workspace_memberships.deactivated_at,
      workspace_memberships.manager_user_id::text as manager_user_id,
      workspace_memberships.invited_by::text as invited_by,
      workspace_memberships.created_at,
      workspace_memberships.updated_at
  `;

  return rows[0] ? mapWorkspaceMembershipRow(rows[0]) : null;
}

export async function updateWorkspaceMembershipManager(input: {
  organizationId: string;
  userId: string;
  managerUserId: string | null;
}) {
  if (!(await hasWorkspaceMembershipsTable())) {
    const profile = await prisma.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        organization_id: true,
      },
    });

    if (profile?.organization_id === input.organizationId) {
      await prisma.user.update({
        where: {
          id: input.userId,
        },
        data: {
          manager_user_id: input.managerUserId,
        },
      });
    }

    return;
  }

  await prisma.$executeRaw`
    update public.workspace_memberships
    set
      manager_user_id = ${input.managerUserId ?? null}::uuid,
      updated_at = now()
    where organization_id = ${input.organizationId}::uuid
      and user_id = ${input.userId}::uuid
  `;
}

export async function updateWorkspaceMembershipStatus(input: {
  organizationId: string;
  userId: string;
  status: WorkspaceMembershipStatus;
}) {
  if (!(await hasWorkspaceMembershipsTable())) {
    const profile = await prisma.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        organization_id: true,
      },
    });

    if (profile?.organization_id === input.organizationId) {
      await prisma.user.update({
        where: {
          id: input.userId,
        },
        data: {
          is_active: input.status !== "inactive",
        },
      });
    }

    return;
  }

  await prisma.$executeRaw`
    update public.workspace_memberships
    set
      status = ${input.status},
      deactivated_at = ${input.status === "inactive" ? Prisma.sql`now()` : Prisma.sql`null`},
      updated_at = now()
    where organization_id = ${input.organizationId}::uuid
      and user_id = ${input.userId}::uuid
  `;
}
