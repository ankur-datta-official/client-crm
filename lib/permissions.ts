import { PERMISSION_GROUPS } from "@/lib/team/types";

export const APP_ROLES = {
  organizationAdmin: "organization-admin",
  salesManager: "sales-manager",
  salesExecutive: "sales-executive",
  supportUser: "support-user",
  viewer: "viewer",
} as const;

export const APP_ROLE_SLUGS = Object.values(APP_ROLES);

export type AppRoleSlug = (typeof APP_ROLE_SLUGS)[number];

export const ALL_PERMISSION_KEYS = Array.from(
  new Set(
    Object.values(PERMISSION_GROUPS).flatMap((group) => group.permissions),
  ),
);

export type AppPermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

export const PROTECTED_ROUTE_RULES = [
  { prefix: "/admin", permission: null },
  { prefix: "/dashboard", permission: "dashboard.view" },
  { prefix: "/companies", permission: "companies.view" },
  { prefix: "/contacts", permission: "contacts.view" },
  { prefix: "/meetings", permission: "meetings.view" },
  { prefix: "/followups", permission: "followups.view" },
  { prefix: "/pipeline", permission: "companies.view" },
  { prefix: "/documents", permission: "documents.view" },
  { prefix: "/need-help", permission: "help_requests.view" },
  { prefix: "/reports", permission: "reports.view" },
  { prefix: "/team", permission: "team.view" },
  { prefix: "/settings", permission: "settings.view" },
  { prefix: "/onboarding", permission: null },
] as const;

export { PERMISSION_GROUPS };

export function isAppRoleSlug(value: string): value is AppRoleSlug {
  return APP_ROLE_SLUGS.includes(value as AppRoleSlug);
}

export function isKnownPermission(value: string): value is AppPermissionKey {
  return ALL_PERMISSION_KEYS.includes(value as AppPermissionKey);
}

export function hasRole(
  userRoles: readonly string[],
  requiredRole: AppRoleSlug | readonly AppRoleSlug[],
) {
  const expectedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return expectedRoles.some((role) => userRoles.includes(role));
}

export function hasPermission(
  userPermissions: readonly string[],
  requiredPermission: AppPermissionKey | readonly AppPermissionKey[],
) {
  if (userPermissions.includes("*")) {
    return true;
  }

  const expectedPermissions = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];

  return expectedPermissions.some((permission) => userPermissions.includes(permission));
}

export function canAccessRoute(
  pathname: string,
  userPermissions: readonly string[],
  isAuthenticated: boolean,
) {
  const rule = PROTECTED_ROUTE_RULES.find((entry) => pathname.startsWith(entry.prefix));

  if (!rule) {
    return true;
  }

  if (!isAuthenticated) {
    return false;
  }

  if (!rule.permission) {
    return true;
  }

  return hasPermission(userPermissions, rule.permission);
}

type ResourceAccessInput = {
  actorOrganizationId?: string | null;
  resourceOrganizationId?: string | null;
  actorUserId?: string | null;
  resourceOwnerUserId?: string | null;
  allowSameOrganization?: boolean;
  allowSelf?: boolean;
};

export function canAccessResource({
  actorOrganizationId,
  resourceOrganizationId,
  actorUserId,
  resourceOwnerUserId,
  allowSameOrganization = true,
  allowSelf = false,
}: ResourceAccessInput) {
  if (
    allowSameOrganization
    && actorOrganizationId
    && resourceOrganizationId
    && actorOrganizationId === resourceOrganizationId
  ) {
    return true;
  }

  if (allowSelf && actorUserId && resourceOwnerUserId && actorUserId === resourceOwnerUserId) {
    return true;
  }

  return false;
}
