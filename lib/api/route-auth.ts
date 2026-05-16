import { NextResponse } from "next/server";
import { getCurrentProfile, getCurrentUser, hasPermission } from "@/lib/auth/session";

type RequireApiAccessOptions = {
  requireOrganization?: boolean;
  requiredPermission?: string;
};

type RequireApiAccessResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireApiAccess(
  options: RequireApiAccessOptions = {},
): Promise<RequireApiAccessResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (options.requireOrganization || options.requiredPermission) {
    const profile = await getCurrentProfile();

    if (!profile?.is_active) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Account inactive" }, { status: 403 }),
      };
    }

    if (options.requireOrganization && (!profile.organization_id || !profile.workspace_is_active)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Workspace not available." }, { status: 400 }),
      };
    }
  }

  if (options.requiredPermission) {
    const allowed = await hasPermission(options.requiredPermission);

    if (!allowed) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return { ok: true };
}
