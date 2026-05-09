"use server";

import { cache } from "react";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type NotificationRow = {
  id: string;
  organization_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
};

type NotificationCenterData = {
  notifications: NotificationRow[];
  unreadCount: number;
};

const getNotificationCenterDataCached = cache(
  async (organizationId: string, userId: string, limit: number): Promise<NotificationCenterData> => {
    const [rows, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where: {
          organization_id: organizationId,
          user_id: userId,
        },
        orderBy: {
          created_at: "desc",
        },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          organization_id: organizationId,
          user_id: userId,
          is_read: false,
        },
      }),
    ]);

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        organization_id: row.organization_id,
        user_id: row.user_id,
        type: row.type,
        title: row.title,
        message: row.message,
        link: row.link,
        is_read: row.is_read,
        read_at: row.read_at?.toISOString() ?? null,
        created_at: row.created_at.toISOString(),
      })),
      unreadCount,
    };
  },
);

export async function getNotificationCenterData(limit = 8): Promise<NotificationCenterData> {
  const organization = await requireOrganization();
  const user = await getCurrentUser();

  if (!user) {
    return {
      notifications: [],
      unreadCount: 0,
    };
  }

  return getNotificationCenterDataCached(organization.id, user.id, limit);
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
  const organization = await requireOrganization();
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  await prisma.notification.updateMany({
    data: {
      is_read: true,
      read_at: new Date(),
    },
    where: {
      id: notificationId,
      organization_id: organization.id,
      user_id: user.id,
    },
  });

  return { success: true };
}

export async function markAllNotificationsAsRead() {
  const organization = await requireOrganization();
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  await prisma.notification.updateMany({
    data: {
      is_read: true,
      read_at: new Date(),
    },
    where: {
      organization_id: organization.id,
      user_id: user.id,
      is_read: false,
    },
  });

  return { success: true };
}

export async function createNotification(input: CreateNotificationInput) {
  const organization = await requireOrganization();

  await prisma.notification.create({
    data: {
      organization_id: organization.id,
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    },
  });

  return { success: true };
}
