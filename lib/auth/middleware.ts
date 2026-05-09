import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/lib/auth";
import { getAuthProvider } from "@/lib/auth/provider";
import { canAccessRoute, PROTECTED_ROUTE_RULES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceIdForUser } from "@/lib/workspace/service";

const protectedPrefixes = PROTECTED_ROUTE_RULES.map((rule) => rule.prefix);
const authPrefixes = ["/auth/login", "/auth/register"];

type SessionState = {
  organizationId: string | null;
  isActive: boolean;
  permissions: string[];
};

async function getSessionState(request: NextRequest): Promise<SessionState | null> {
  const provider = getAuthProvider();
  let userId: string | null = null;

  if (provider === "nextauth") {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });

    userId = typeof token?.sub === "string" ? token.sub : null;
  } else {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    userId = session?.user?.id ?? null;
  }

  if (!userId) {
    return null;
  }

  const profile = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      is_active: true,
      is_super_admin: true,
    },
  });

  if (!profile) {
    return null;
  }

  const organizationId = await resolveActiveWorkspaceIdForUser(userId);

  if (profile.is_super_admin) {
    return {
      organizationId,
      isActive: profile.is_active,
      permissions: ["*"],
    };
  }

  const userRoles = organizationId
    ? await prisma.userRole.findMany({
        where: {
          user_id: userId,
          organization_id: organizationId,
        },
        select: {
          role: {
            select: {
              slug: true,
              name: true,
            },
          },
          role_id: true,
        },
      })
    : [];

  const hasOrganizationAdminRole = userRoles.some(
    (record) =>
      record.role?.slug === "organization-admin"
      || record.role?.name?.toLowerCase().includes("admin"),
  );

  if (hasOrganizationAdminRole) {
    return {
      organizationId,
      isActive: profile.is_active,
      permissions: ["*"],
    };
  }

  const roleIds = userRoles.map((record) => record.role_id);
  const rolePermissions = roleIds.length
    ? await prisma.rolePermission.findMany({
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
      })
    : [];

  return {
    organizationId,
    isActive: profile.is_active,
    permissions: Array.from(
      new Set(
        rolePermissions
          .map((record) => record.permission.key)
          .filter((permission): permission is string => Boolean(permission)),
      ),
    ),
  };
}

export async function updateAuthSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAuthRoute = authPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const sessionState = await getSessionState(request);

  if (!sessionState && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (sessionState && isAuthRoute) {
    const url = request.nextUrl.clone();

    if (!sessionState.isActive) {
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }

    url.pathname = sessionState.organizationId ? "/dashboard" : "/onboarding/workspace";
    return NextResponse.redirect(url);
  }

  if (sessionState && isProtected) {
    if (!sessionState.isActive) {
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }

    if (!sessionState.organizationId && !isOnboardingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding/workspace";
      return NextResponse.redirect(url);
    }

    if (!canAccessRoute(pathname, sessionState.permissions, true)) {
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request });
}
