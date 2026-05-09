"use server";

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

export async function getNotifications(limit = 8): Promise<NotificationRow[]> {
  const organization = await requireOrganization();
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const rows = await prisma.notification.findMany({
    where: {
      organization_id: organization.id,
      user_id: user.id,
    },
    orderBy: {
      created_at: "desc",
    },
    take: limit,
  });

  return rows.map((row) => ({
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
  }));
}

export async function getUnreadNotificationCount() {
  const organization = await requireOrganization();
  const user = await getCurrentUser();

  if (!user) {
    return 0;
  }

  return prisma.notification.count({
    where: {
      organization_id: organization.id,
      user_id: user.id,
      is_read: false,
    },
  });
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
