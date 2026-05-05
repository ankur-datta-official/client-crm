import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { resolveProfileAvatarUrl } from "@/lib/profile/profile-utils";
import { createClient } from "@/lib/supabase/server";

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

type UserRoleRow = {
  role_id: string;
  roles: {
    id: string;
    name: string;
    slug: string;
    is_system: boolean;
  } | null;
};

type RolePermissionRow = {
  permissions: {
    key: string;
  } | null;
};

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, organization_id, email, full_name, avatar_url, job_title, department, phone, manager_user_id, is_active, is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    avatar_url: await resolveProfileAvatarUrl(data.avatar_url),
  };
}

export async function getCurrentOrganization(): Promise<Organization | null> {
  const profile = await getCurrentProfile();

  if (!profile?.organization_id || !profile.is_active) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, company_size, owner_user_id")
    .eq("id", profile.organization_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

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

export async function getUserPermissions(): Promise<string[]> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();

  if (!user || !profile?.organization_id || !profile.is_active) {
    return [];
  }

  if (profile.is_super_admin) {
    return ["*"];
  }

  try {
    const supabase = await createClient();

    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role_id, roles(id, name, slug, is_system)")
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id);

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      return [];
    }

    const rolesData = userRoles as unknown as UserRoleRow[];
    const permissions = new Set<string>();
    const roleList = rolesData?.filter((record) => record.roles) ?? [];
    const isAdmin = roleList.some(
      (record) => record.roles?.slug === "organization-admin" || record.roles?.name?.toLowerCase().includes("admin"),
    );

    if (isAdmin) {
      return ["*"];
    }

    const roleIds = roleList.map((record) => record.role_id).filter(Boolean);
    if (roleIds.length === 0) {
      return [];
    }

    const { data: rolePerms, error: rolePermsError } = await supabase
      .from("role_permissions")
      .select("permissions(key)")
      .in("role_id", roleIds);

    if (rolePermsError) {
      console.error("Error fetching role permissions:", rolePermsError);
      return [];
    }

    const permissionRows = rolePerms as unknown as RolePermissionRow[];
    for (const row of permissionRows ?? []) {
      if (row.permissions?.key) {
        permissions.add(row.permissions.key);
      }
    }

    return [...permissions];
  } catch (error) {
    console.error("Permission check error:", error);
    return [];
  }
}

export async function hasPermission(permission: string): Promise<boolean> {
  const permissions = await getUserPermissions();
  return permissions.includes("*") || permissions.includes(permission);
}

export async function requirePermission(permission: string): Promise<void> {
  const allowed = await hasPermission(permission);

  if (!allowed) {
    redirect("/unauthorized");
  }
}

export async function requireAnyPermission(permissions: string[]): Promise<void> {
  for (const permission of permissions) {
    if (await hasPermission(permission)) {
      return;
    }
  }

  redirect("/unauthorized");
}
