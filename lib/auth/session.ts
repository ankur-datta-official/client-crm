import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { getAuthProvider } from "@/lib/auth/provider";
import {
  type AppPermissionKey,
  hasPermission as hasPermissionKey,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveProfileAvatarUrl } from "@/lib/profile/profile-utils";
import { resolveActiveWorkspaceIdForUser } from "@/lib/workspace/service";

export type AuthUser = {
  id: string;
  email: string | null;
  name?: string | null;
  image?: string | null;
};

export type Profile = {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  manager_user_id?: string | null;
  is_active: boolean;
  is_super_admin: boolean;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  company_size: string | null;
  owner_user_id: string;
};

async function getCurrentAuthSession() {
  if (getAuthProvider() === "nextauth") {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return null;
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      },
    };
  }

  return auth.api.getSession({
    headers: await headers(),
  });
}

async function getPrismaProfileByUserId(userId: string): Promise<Profile | null> {
  await resolveActiveWorkspaceIdForUser(userId);

  const data = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      organization_id: true,
      email: true,
      name: true,
      image: true,
      job_title: true,
      department: true,
      phone: true,
      manager_user_id: true,
      is_active: true,
      is_super_admin: true,
    },
  });

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    organization_id: data.organization_id,
    email: data.email,
    full_name: data.name,
    avatar_url: await resolveProfileAvatarUrl(data.image, 900, {
      profileId: data.id,
      organizationId: data.organization_id,
    }),
    job_title: data.job_title,
    department: data.department,
    phone: data.phone,
    manager_user_id: data.manager_user_id,
    is_active: data.is_active,
    is_super_admin: data.is_super_admin,
  };
}

async function getPrismaOrganizationById(organizationId: string): Promise<Organization | null> {
  return prisma.organization.findUnique({
    where: {
      id: organizationId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      company_size: true,
      owner_user_id: true,
    },
  });
}

async function getPrismaUserPermissionsByUserId(userId: string): Promise<string[]> {
  const profile = await getPrismaProfileByUserId(userId);

  if (!profile?.organization_id || !profile.is_active) {
    return [];
  }

  if (profile.is_super_admin) {
    return ["*"];
  }

  try {
    const userRoles = await prisma.userRole.findMany({
      where: {
        user_id: userId,
        organization_id: profile.organization_id,
      },
      select: {
        role_id: true,
        role: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    const roleIds = userRoles
      .filter((record) => record.role)
      .map((record) => record.role_id)
      .filter(Boolean);

    const hasOrganizationAdminRole = userRoles.some(
      (record) =>
        record.role?.slug === "organization-admin"
        || record.role?.name?.toLowerCase().includes("admin"),
    );

    if (hasOrganizationAdminRole) {
      return ["*"];
    }

    if (roleIds.length === 0) {
      return [];
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role_id: {
          in: roleIds,
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

    return Array.from(
      new Set(
        rolePermissions
          .map((record) => record.permission.key)
          .filter((key): key is string => Boolean(key)),
      ),
    );
  } catch (error) {
    console.error("Permission check error:", error);
    return [];
  }
}

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getCurrentAuthSession();

  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
});

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  return user;
}

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  return user ? getPrismaProfileByUserId(user.id) : null;
});

export const getCurrentOrganization = cache(async (): Promise<Organization | null> => {
  const profile = await getCurrentProfile();

  if (!profile?.organization_id || !profile.is_active) {
    return null;
  }

  return getPrismaOrganizationById(profile.organization_id);
});

export const getCurrentAppContext = cache(async () => {
  const user = await requireAuth();
  const [profile, organization] = await Promise.all([
    getCurrentProfile(),
    getCurrentOrganization(),
  ]);

  return { user, profile, organization };
});

export async function requireOrganization(): Promise<Organization> {
  await requireAuth();
  const profile = await getCurrentProfile();

  if (profile && !profile.is_active) {
    redirect("/unauthorized");
  }

  const organization = await getCurrentOrganization();

  if (!organization) {
    redirect("/onboarding/workspace");
  }

  return organization;
}

export const getUserPermissions = cache(async (): Promise<string[]> => {
  const user = await getCurrentUser();
  return user ? getPrismaUserPermissionsByUserId(user.id) : [];
});

export async function hasPermission(permission: AppPermissionKey | string): Promise<boolean> {
  const permissions = await getUserPermissions();
  return hasPermissionKey(permissions, permission as AppPermissionKey);
}

export async function requirePermission(permission: AppPermissionKey | string): Promise<void> {
  const allowed = await hasPermission(permission);

  if (!allowed) {
    redirect("/unauthorized");
  }
}

export async function requireAnyPermission(permissions: string[]): Promise<void> {
  const availablePermissions = await getUserPermissions();

  if (availablePermissions.includes("*")) {
    return;
  }

  if (permissions.some((permission) => availablePermissions.includes(permission))) {
    return;
  }

  redirect("/unauthorized");
}
