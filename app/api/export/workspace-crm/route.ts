import { NextResponse } from "next/server";
import { getCurrentProfile, getCurrentUser, hasPermission } from "@/lib/auth/session";
import { buildWorkspaceCrmExport } from "@/lib/crm/workspace-export";
import { logServerError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await hasPermission("settings.manage");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await getCurrentProfile();
    if (!profile?.organization_id || !profile.is_active) {
      return NextResponse.json({ error: "Workspace not available." }, { status: 400 });
    }

    const payload = (await request.json().catch(() => ({}))) as { includeFiles?: boolean };
    const result = await buildWorkspaceCrmExport({
      includeFiles: Boolean(payload.includeFiles),
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("api.export.workspace-crm", error);
    return NextResponse.json({ error: "Unable to export workspace CRM data right now." }, { status: 500 });
  }
}
