"use server";

import { cache } from "react";
import { Prisma } from "@prisma/client";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type NotificationScope = "workspace" | "global";
export type NotificationPayload = Record<string, unknown> | null;

export type NotificationRow = {
  id: string;
  organization_id: string | null;
  user_id: string;
  scope: NotificationScope;
  type: string;
  title: string;
  message: string;
  link: string | null;
  payload: NotificationPayload;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type NotificationCenterData = {
  notifications: NotificationRow[];
  unreadCount: number;
};

type NotificationDbRow = {
  id: string;
  organization_id: string | null;
  user_id: string;
  scope: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  payload: NotificationPayload;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
};

type BaseNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  payload?: NotificationPayload;
};

type WorkspaceNotificationInput = BaseNotificationInput & {
  organizationId?: string | null;
};

type GlobalNotificationInput = BaseNotificationInput;

type NotificationViewer = {
  userId: string;
  organizationId: string | null;
  isSuperAdmin: boolean;
};

function mapNotificationRow(row: NotificationDbRow): NotificationRow {
  return {
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    scope: row.scope === "global" ? "global" : "workspace",
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    payload: row.payload ?? null,
    is_read: row.is_read,
    read_at: row.read_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

function toJsonbSql(payload: NotificationPayload | undefined) {
  if (!payload) {
    return Prisma.sql`null::jsonb`;
  }

  return Prisma.sql`${JSON.stringify(payload)}::jsonb`;
}

function buildVisibleNotificationWhereSql(viewer: NotificationViewer) {
  if (viewer.isSuperAdmin) {
    if (viewer.organizationId) {
      return Prisma.sql`
        n.user_id = ${viewer.userId}::uuid
        and (
          n.scope = 'global'
          or (
            n.scope = 'workspace'
            and n.organization_id = ${viewer.organizationId}::uuid
          )
        )
      `;
    }

    return Prisma.sql`
      n.user_id = ${viewer.userId}::uuid
      and n.scope = 'global'
    `;
  }

  if (!viewer.organizationId) {
    return Prisma.sql`
      n.user_id = ${viewer.userId}::uuid
      and 1 = 0
    `;
  }

  return Prisma.sql`
    n.user_id = ${viewer.userId}::uuid
    and n.scope = 'workspace'
    and n.organization_id = ${viewer.organizationId}::uuid
  `;
}

const getNotificationCenterDataCached = cache(
  async (
    userId: string,
    organizationId: string,
    isSuperAdmin: boolean,
    limit: number,
  ): Promise<NotificationCenterData> => {
    const viewer: NotificationViewer = {
      userId,
      organizationId: organizationId || null,
      isSuperAdmin,
    };
    const whereSql = buildVisibleNotificationWhereSql(viewer);

    const [rows, unreadRows] = await Promise.all([
      prisma.$queryRaw<NotificationDbRow[]>`
        select
          n.id::text as id,
          n.organization_id::text as organization_id,
          n.user_id::text as user_id,
          n.scope,
          n.type,
          n.title,
          n.message,
          n.link,
          n.payload,
          n.is_read,
          n.read_at,
          n.created_at
        from public.notifications n
        where ${whereSql}
        order by n.created_at desc
        limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from public.notifications n
        where ${whereSql}
          and n.is_read = false
      `,
    ]);

    return {
      notifications: rows.map(mapNotificationRow),
      unreadCount: Number(unreadRows[0]?.count ?? 0),
    };
  },
);

async function getNotificationViewer(): Promise<NotificationViewer | null> {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()]);

  if (!user || !profile?.is_active) {
    return null;
  }

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    isSuperAdmin: profile.is_super_admin,
  };
}

export async function getNotificationCenterData(limit = 8): Promise<NotificationCenterData> {
  const viewer = await getNotificationViewer();

  if (!viewer) {
    return {
      notifications: [],
      unreadCount: 0,
    };
  }

  return getNotificationCenterDataCached(
    viewer.userId,
    viewer.organizationId ?? "",
    viewer.isSuperAdmin,
    limit,
  );
}

export async function getNotifications(limit = 8): Promise<NotificationRow[]> {
  const data = await getNotificationCenterData(limit);
  return data.notifications;
}

export async function getUnreadNotificationCount() {
  const data = await getNotificationCenterData();
  return data.unreadCount;
}

export async function markNotificationAsRead(notificationId: string) {
  const viewer = await getNotificationViewer();

  if (!viewer) {
    throw new Error("Authentication required.");
  }

  const whereSql = buildVisibleNotificationWhereSql(viewer);

  await prisma.$executeRaw`
    update public.notifications n
    set
      is_read = true,
      read_at = now()
    where n.id = ${notificationId}::uuid
      and ${whereSql}
  `;

  return { success: true };
}

export async function markAllNotificationsAsRead() {
  const viewer = await getNotificationViewer();

  if (!viewer) {
    throw new Error("Authentication required.");
  }

  const whereSql = buildVisibleNotificationWhereSql(viewer);

  await prisma.$executeRaw`
    update public.notifications n
    set
      is_read = true,
      read_at = now()
    where ${whereSql}
      and n.is_read = false
  `;

  return { success: true };
}

export async function createWorkspaceNotification(input: WorkspaceNotificationInput) {
  const profile = await getCurrentProfile();
  const organizationId = input.organizationId ?? profile?.organization_id ?? null;

  if (!organizationId) {
    throw new Error("Workspace notifications require an active organization.");
  }

  await prisma.$executeRaw`
    insert into public.notifications (
      organization_id,
      user_id,
      scope,
      type,
      title,
      message,
      link,
      payload
    )
    values (
      ${organizationId}::uuid,
      ${input.userId}::uuid,
      'workspace',
      ${input.type},
      ${input.title},
      ${input.message},
      ${input.link ?? null},
      ${toJsonbSql(input.payload)}
    )
  `;

  return { success: true };
}

export async function createGlobalNotification(input: GlobalNotificationInput) {
  await prisma.$executeRaw`
    insert into public.notifications (
      organization_id,
      user_id,
      scope,
      type,
      title,
      message,
      link,
      payload
    )
    values (
      null,
      ${input.userId}::uuid,
      'global',
      ${input.type},
      ${input.title},
      ${input.message},
      ${input.link ?? null},
      ${toJsonbSql(input.payload)}
    )
  `;

  return { success: true };
}

export async function createGlobalNotifications(input: {
  userIds: string[];
  type: string;
  title: string;
  message: string;
  link?: string | null;
  payload?: NotificationPayload;
}) {
  const uniqueUserIds = Array.from(new Set(input.userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return { success: true, count: 0 };
  }

  const valuesSql = Prisma.join(
    uniqueUserIds.map((userId) => Prisma.sql`(
      null,
      ${userId}::uuid,
      'global',
      ${input.type},
      ${input.title},
      ${input.message},
      ${input.link ?? null},
      ${toJsonbSql(input.payload)}
    )`),
  );

  await prisma.$executeRaw`
    insert into public.notifications (
      organization_id,
      user_id,
      scope,
      type,
      title,
      message,
      link,
      payload
    )
    values ${valuesSql}
  `;

  return { success: true, count: uniqueUserIds.length };
}

export async function createWorkspaceNotifications(input: {
  organizationId?: string | null;
  userIds: string[];
  type: string;
  title: string;
  message: string;
  link?: string | null;
  payload?: NotificationPayload;
}) {
  const profile = await getCurrentProfile();
  const organizationId = input.organizationId ?? profile?.organization_id ?? null;
  const uniqueUserIds = Array.from(new Set(input.userIds.filter(Boolean)));

  if (!organizationId) {
    throw new Error("Workspace notifications require an active organization.");
  }

  if (uniqueUserIds.length === 0) {
    return { success: true, count: 0 };
  }

  const valuesSql = Prisma.join(
    uniqueUserIds.map((userId) => Prisma.sql`(
      ${organizationId}::uuid,
      ${userId}::uuid,
      'workspace',
      ${input.type},
      ${input.title},
      ${input.message},
      ${input.link ?? null},
      ${toJsonbSql(input.payload)}
    )`),
  );

  await prisma.$executeRaw`
    insert into public.notifications (
      organization_id,
      user_id,
      scope,
      type,
      title,
      message,
      link,
      payload
    )
    values ${valuesSql}
  `;

  return { success: true, count: uniqueUserIds.length };
}

export async function createNotification(input: WorkspaceNotificationInput) {
  return createWorkspaceNotification(input);
}
