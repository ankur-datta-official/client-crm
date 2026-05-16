import "server-only";

import { redirect } from "next/navigation";
import {
  hasPermission as hasPermissionKey,
  hasRole as hasRoleKey,
  isAppRoleSlug,
  type AppPermissionKey,
  type AppRoleSlug,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { AuthUser, Profile } from "@/lib/auth/session";
import {
  getCurrentProfile as getSessionCurrentProfile,
  getCurrentUser as getSessionCurrentUser,
  getUserPermissions,
  requireAuth as requireSessionAuth,
} from "@/lib/auth/session";

async function getCurrentUserRoleSlugsInternal(userId: string, organizationId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
    select: {
      role: {
        select: {
          slug: true,
        },
      },
    },
  });

  return userRoles
    .map((record) => record.role?.slug)
    .filter((slug): slug is string => Boolean(slug));
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return getSessionCurrentUser();
}

export async function requireAuth(): Promise<AuthUser> {
  return requireSessionAuth();
}

export async function getCurrentUserProfile(): Promise<Profile | null> {
  return getSessionCurrentProfile();
}

export async function getCurrentUserRoles(): Promise<AppRoleSlug[]> {
  const [user, profile] = await Promise.all([
    getSessionCurrentUser(),
    getSessionCurrentProfile(),
  ]);

  if (!user || !profile?.organization_id || !profile.is_active || !profile.workspace_is_active) {
    return [];
  }

  try {
    const roleSlugs = await getCurrentUserRoleSlugsInternal(user.id, profile.organization_id);
    return [...new Set(roleSlugs.filter(isAppRoleSlug))];
  } catch (error) {
    console.error("Failed to load current user roles:", error);
    return [];
  }
}

export async function requireRole(requiredRole: AppRoleSlug | AppRoleSlug[]): Promise<AppRoleSlug[]> {
  const profile = await getSessionCurrentProfile();

  if (profile && !profile.is_active) {
    redirect("/unauthorized");
  }

  if (profile?.is_super_admin) {
    return [];
  }

  const currentRoles = await getCurrentUserRoles();

  if (!hasRoleKey(currentRoles, requiredRole)) {
    redirect("/unauthorized");
  }

  return currentRoles;
}

export async function requirePermission(permission: AppPermissionKey | string): Promise<void> {
  const permissions = await getUserPermissions();

  if (!hasPermissionKey(permissions, permission as AppPermissionKey)) {
    redirect("/unauthorized");
  }
}

export async function canCurrentUser(permission: AppPermissionKey | string): Promise<boolean> {
  const permissions = await getUserPermissions();
  return hasPermissionKey(permissions, permission as AppPermissionKey);
}
